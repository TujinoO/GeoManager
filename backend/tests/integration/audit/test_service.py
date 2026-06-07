from unittest.mock import MagicMock

from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase

from apps.audit.models import OperationLog
from apps.audit.service import _client_ip, log_operation


class OperationLogModelTests(TestCase):
    def test_str_representation(self):
        log = OperationLog(module="catalog", action="export", status="success")
        self.assertEqual(str(log), "catalog.export success")

    def test_status_choices(self):
        self.assertEqual(OperationLog.Status.SUCCESS, "success")
        self.assertEqual(OperationLog.Status.WARNING, "warning")
        self.assertEqual(OperationLog.Status.FAILED, "failed")

    def test_ordering_by_created_at_desc(self):
        OperationLog.objects.create(module="core", action="login", status="success")
        OperationLog.objects.create(module="catalog", action="query", status="success")
        logs = list(OperationLog.objects.all())
        self.assertEqual(logs[0].module, "catalog")
        self.assertEqual(logs[1].module, "core")


class LogOperationTests(TestCase):
    def test_creates_log_for_authenticated_user(self):
        user = get_user_model().objects.create_user(
            username="logger-test", password="pass12345"
        )

        log_operation(user, "catalog", "export", "success", "导出成功")

        log = OperationLog.objects.first()
        self.assertIsNotNone(log)
        self.assertEqual(log.user, user)
        self.assertEqual(log.module, "catalog")
        self.assertEqual(log.action, "export")
        self.assertEqual(log.status, "success")
        self.assertEqual(log.message, "导出成功")

    def test_creates_log_with_null_user_for_anonymous(self):
        anonymous = MagicMock()
        anonymous.is_authenticated = False

        log_operation(anonymous, "core", "login", "failed", "登录失败")

        log = OperationLog.objects.first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.user)

    def test_creates_log_with_null_user_for_none(self):
        log_operation(None, "core", "login", "failed", "登录失败")

        log = OperationLog.objects.first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.user)

    def test_extracts_ip_from_request(self):
        user = get_user_model().objects.create_user(
            username="ip-test", password="pass12345"
        )
        factory = RequestFactory()
        request = factory.get("/api/test/")
        request.META["REMOTE_ADDR"] = "192.168.1.100"

        log_operation(user, "catalog", "query", "success", request=request)

        log = OperationLog.objects.first()
        self.assertEqual(log.ip_address, "192.168.1.100")

    def test_extracts_ip_from_x_forwarded_for(self):
        user = get_user_model().objects.create_user(
            username="forwarded-test", password="pass12345"
        )
        factory = RequestFactory()
        request = factory.get("/api/test/")
        request.META["HTTP_X_FORWARDED_FOR"] = "10.0.0.1, 10.0.0.2"

        log_operation(user, "catalog", "query", "success", request=request)

        log = OperationLog.objects.first()
        self.assertEqual(log.ip_address, "10.0.0.1")

    def test_handles_none_request(self):
        user = get_user_model().objects.create_user(
            username="no-request-test", password="pass12345"
        )

        log_operation(user, "core", "test", "success")

        log = OperationLog.objects.first()
        self.assertIsNone(log.ip_address)


class ClientIpTests(TestCase):
    def test_returns_none_for_none_request(self):
        self.assertIsNone(_client_ip(None))

    def test_returns_remote_addr(self):
        request = MagicMock()
        request.META = {"REMOTE_ADDR": "127.0.0.1"}
        self.assertEqual(_client_ip(request), "127.0.0.1")

    def test_returns_first_x_forwarded_for(self):
        request = MagicMock()
        request.META = {"HTTP_X_FORWARDED_FOR": "10.0.0.1, 10.0.0.2, 10.0.0.3"}
        self.assertEqual(_client_ip(request), "10.0.0.1")

    def test_returns_none_when_no_ip_info(self):
        request = MagicMock()
        request.META = {}
        self.assertIsNone(_client_ip(request))
