import {
  DatabaseOutlined,
  DeploymentUnitOutlined,
  EnvironmentOutlined,
  FundProjectionScreenOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  BorderBeam,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Radio,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import capfedLogoWhite from "../assets/capfed-logo-white.svg";
import loginBackground01 from "../assets/login-carousel-01.webp";
import loginBackground02 from "../assets/login-carousel-02.webp";
import loginBackground03 from "../assets/login-carousel-03.webp";
import loginBackground04 from "../assets/login-carousel-04.webp";
import loginBackground05 from "../assets/login-carousel-05.webp";
import loginBackground06 from "../assets/login-carousel-06.webp";
import { oceanBorderBeam } from "../components/oceanBorderBeam";
import { platformBrand } from "../config/platformBrand";
import { useAppContext } from "../contexts/AppContext";
import type {
  LoginFormValues,
  LoginOverviewResponse,
  LoginOverviewStatus,
  RegisterFormValues,
} from "../types";

const platformChineseName = platformBrand.chineseName;
const platformEnglishName = platformBrand.englishName;
const platformShortName = platformBrand.shortName;
const platformEdition = platformBrand.edition;
const platformVersion = "v1.0.0";
const loginBackgrounds = [
  loginBackground01,
  loginBackground02,
  loginBackground03,
  loginBackground04,
  loginBackground05,
  loginBackground06,
] as const;
const loginBackgroundIntervalMs = 9000;

const fallbackCapabilityTags = [
  "遥感影像",
  "矢量边界",
  "野外样方",
  "长期监测",
  "专题共享",
];

function fallbackLoginStats() {
  return [
    {
      id: "dataResources",
      icon: <DatabaseOutlined style={{ fontSize: 18 }} />,
      label: "平台数据资源",
      note: "实时统计暂不可用",
      value: 0,
      displayValue: "--",
    },
    {
      id: "thematicLayers",
      icon: <FundProjectionScreenOutlined style={{ fontSize: 18 }} />,
      label: "专题图层",
      note: "实时统计暂不可用",
      value: 0,
      displayValue: "--",
    },
    {
      id: "monitoringSites",
      icon: <DeploymentUnitOutlined style={{ fontSize: 18 }} />,
      label: "监测站点",
      note: "实时统计暂不可用",
      value: 0,
      displayValue: "--",
    },
    {
      id: "coveredBasins",
      icon: <EnvironmentOutlined style={{ fontSize: 18 }} />,
      label: "覆盖流域",
      note: "实时统计暂不可用",
      value: 0,
      displayValue: "--",
    },
  ];
}

function metricIcon(metricId: string) {
  const style = { fontSize: 18 };
  if (metricId === "dataResources") return <DatabaseOutlined style={style} />;
  if (metricId === "thematicLayers") {
    return <FundProjectionScreenOutlined style={style} />;
  }
  if (metricId === "monitoringSites") {
    return <DeploymentUnitOutlined style={style} />;
  }
  return <EnvironmentOutlined style={style} />;
}

function serviceNodes(overview: LoginOverviewResponse | null) {
  if (!overview) return [];
  return overview.serviceStatus.nodeSummary.legend.flatMap((item) =>
    Array.from({ length: item.count }, (_, index) => ({
      id: `${item.status}-${index + 1}`,
      state: item.status as LoginOverviewStatus,
    })),
  );
}

export default function LoginPage() {
  const { bootstrap, setUser } = useAppContext();
  const { message, modal } = App.useApp();
  const [submittingAction, setSubmittingAction] = useState<
    "login" | "register" | "guest" | null
  >(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [accountPurpose, setAccountPurpose] =
    useState<RegisterFormValues["accountPurpose"]>("standard");
  const [overview, setOverview] = useState<LoginOverviewResponse | null>(null);
  const [activeBackgroundIndex, setActiveBackgroundIndex] = useState(0);
  const isSubmitting = submittingAction !== null;

  useEffect(() => {
    let mounted = true;
    api
      .loginOverview()
      .then((result) => {
        if (mounted) setOverview(result);
      })
      .catch(() => {
        if (mounted) setOverview(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveBackgroundIndex(
        (currentIndex) => (currentIndex + 1) % loginBackgrounds.length,
      );
    }, loginBackgroundIntervalMs);

    return () => window.clearInterval(intervalId);
  }, []);

  const loginStats = useMemo(
    () =>
      overview?.metrics.map((metric) => ({
        ...metric,
        icon: metricIcon(metric.id),
      })) ?? fallbackLoginStats(),
    [overview],
  );
  const capabilityTags =
    overview?.hero.capabilityTags ?? fallbackCapabilityTags;
  const stationStatuses = useMemo(() => serviceNodes(overview), [overview]);
  const serviceStatusSummary = overview?.serviceStatus.nodeSummary.legend ?? [];

  async function handleFinish(values: LoginFormValues) {
    setSubmittingAction("login");
    try {
      await api.csrf();
      const response = await api.login(
        values.username,
        values.password,
        Boolean(values.remember),
      );
      setUser(response.user);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
      setSubmittingAction(null);
    }
  }

  async function handleRegister(values: RegisterFormValues) {
    setSubmittingAction("register");
    try {
      await api.csrf();
      const response = await api.register(values);
      message.success(response.detail);
      setUser(response.user);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败");
      setSubmittingAction(null);
    }
  }

  function handleForgotPassword() {
    modal.info({
      title: "请联系平台管理员重置密码",
      content:
        "当前阶段暂未接入邮件找回密码。请联系平台管理员在“认证授权—用户管理”中重置密码，并妥善保存管理员提供的临时密码。",
      okText: "我知道了",
    });
  }

  async function handleGuestLogin() {
    setSubmittingAction("guest");
    try {
      await api.csrf();
      const response = await api.guestLogin();
      setUser(response.user);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "游客登录失败");
      setSubmittingAction(null);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-background-carousel" aria-hidden="true">
        {loginBackgrounds.map((background, index) => (
          <div
            className={`login-background-slide${
              index === activeBackgroundIndex ? " is-active" : ""
            }`}
            data-active={index === activeBackgroundIndex}
            key={background}
            style={{ backgroundImage: `url("${background}")` }}
          />
        ))}
      </div>
      <section className="login-hero-panel" aria-label="平台概览">
        <header className="login-brand-head">
          <span className="login-logo-frame">
            <img
              src={capfedLogoWhite}
              alt={`${platformChineseName} Logo`}
              width={48}
              height={48}
            />
          </span>
          <span className="login-brand-text">
            <strong>{platformShortName}</strong>
            <span>{platformEnglishName}</span>
          </span>
        </header>

        <div className="login-identity">
          <span className="login-mark">生态保护数据共享平台</span>
          <Typography.Title level={1}>{platformChineseName}</Typography.Title>
          <strong className="login-english-title">{platformEnglishName}</strong>
          <div className="login-capability-tags">
            {capabilityTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>

        <div className="login-stat-grid">
          {loginStats.map((stat) => (
            <BorderBeam color={oceanBorderBeam} key={stat.label}>
              <div className="login-stat">
                <span className="login-stat-icon">{stat.icon}</span>
                <strong>{stat.displayValue}</strong>
                <span>{stat.label}</span>
                <small>{stat.note}</small>
              </div>
            </BorderBeam>
          ))}
        </div>

        <BorderBeam color={oceanBorderBeam}>
          <div className="login-ops-panel">
            <div className="login-ops-copy">
              <span>{overview?.serviceStatus.title ?? "平台服务状态"}</span>
              <strong>
                {overview?.serviceStatus.headline ?? "正在读取平台实时状态"}
              </strong>
              <small>
                {overview?.serviceStatus.description ??
                  "平台统计暂不可用，但不影响登录和游客访问。"}
              </small>
            </div>
            <div className="login-ops-status">
              <div className="login-station-grid" aria-hidden="true">
                {stationStatuses.map((station) => (
                  <i key={station.id} data-state={station.state} />
                ))}
              </div>
              <div className="login-status-legend">
                {serviceStatusSummary.map((item) => (
                  <span key={item.status}>
                    <i data-state={item.status} />
                    {item.label} {item.count}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </BorderBeam>

        <footer className="login-version-bar">
          <span>{overview?.platform.edition ?? platformEdition}</span>
          <span>{overview?.platform.version ?? platformVersion}</span>
          <span>
            {overview?.footer.statisticsNotice ?? "正在读取后端平台概览统计"}
          </span>
        </footer>
      </section>

      <BorderBeam color={oceanBorderBeam}>
        <Card className="login-card" variant="borderless">
          <div className="login-card-header">
            <span className="login-card-logo">
              <img src={capfedLogoWhite} alt="" width={32} height={32} />
            </span>
            <span>
              <strong>{platformShortName}</strong>
              <small>统一身份认证</small>
            </span>
          </div>
          <Typography.Title level={2}>
            {mode === "login" ? "用户登录" : "用户注册"}
          </Typography.Title>
          <Typography.Text type="secondary">
            {mode === "login"
              ? "登录后进入数据资源总目录，后台功能按权限显示。"
              : "自助注册默认获得普通用户权限，科研用户权限需提交申请并由管理员审核。"}
          </Typography.Text>

          {mode === "login" ? (
            <Form<LoginFormValues>
              key="login"
              className="login-form"
              layout="vertical"
              initialValues={{ remember: true }}
              onFinish={handleFinish}
              requiredMark={false}
            >
              <Form.Item
                name="username"
                label="账号"
                rules={[{ required: true, message: "请输入账号" }]}
              >
                <Input
                  prefix={<UserOutlined style={{ fontSize: 16 }} />}
                  placeholder="请输入账号"
                  autoComplete="username"
                  size="large"
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ fontSize: 16 }} />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  size="large"
                />
              </Form.Item>
              <div className="login-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住登录状态</Checkbox>
                </Form.Item>
                <Button
                  type="link"
                  size="small"
                  disabled={isSubmitting}
                  onClick={handleForgotPassword}
                >
                  忘记密码
                </Button>
              </div>
              {!bootstrap.allowRegistration && (
                <Alert type="info" showIcon title="当前系统未开放自助注册" />
              )}
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submittingAction === "login"}
                disabled={isSubmitting && submittingAction !== "login"}
                icon={<LoginOutlined style={{ fontSize: 16 }} />}
                size="large"
              >
                登录并进入数据平台
              </Button>
              <div
                className={
                  bootstrap.allowRegistration
                    ? "login-secondary-actions"
                    : "login-secondary-actions login-secondary-actions-single"
                }
              >
                <Button
                  type="link"
                  className="login-secondary-action"
                  loading={submittingAction === "guest"}
                  disabled={isSubmitting && submittingAction !== "guest"}
                  icon={<UserSwitchOutlined style={{ fontSize: 16 }} />}
                  onClick={handleGuestLogin}
                >
                  游客登录
                </Button>
                {bootstrap.allowRegistration && (
                  <Button
                    type="link"
                    className="login-secondary-action"
                    disabled={isSubmitting}
                    icon={<UserAddOutlined style={{ fontSize: 16 }} />}
                    onClick={() => {
                      setAccountPurpose("standard");
                      setMode("register");
                    }}
                  >
                    注册新账号
                  </Button>
                )}
              </div>
              <div className="login-security-note">
                <SafetyCertificateOutlined style={{ fontSize: 16 }} />
                <span>后台功能和数据范围将在登录后按账号权限显示。</span>
              </div>
            </Form>
          ) : (
            <Form<RegisterFormValues>
              key="register"
              className="login-form"
              layout="vertical"
              initialValues={{ accountPurpose: "standard" }}
              onFinish={handleRegister}
              onFinishFailed={(errorInfo) => {
                message.error(firstFormError(errorInfo, "请检查注册信息"));
              }}
              requiredMark={false}
            >
              <Form.Item
                name="username"
                label="账号"
                rules={[{ required: true, message: "请输入账号" }]}
              >
                <Input
                  prefix={<UserOutlined style={{ fontSize: 16 }} />}
                  placeholder="请输入账号"
                  autoComplete="username"
                  size="large"
                />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "请输入有效邮箱" },
                ]}
              >
                <Input
                  placeholder="请输入邮箱"
                  autoComplete="email"
                  size="large"
                />
              </Form.Item>
              <Form.Item
                name="accountPurpose"
                label="账号用途"
                rules={[{ required: true, message: "请选择账号用途" }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  onChange={(event) => setAccountPurpose(event.target.value)}
                  options={[
                    { label: "普通用户", value: "standard" },
                    { label: "申请科研用户", value: "research" },
                  ]}
                />
              </Form.Item>
              {accountPurpose === "research" ? (
                <div className="login-research-fields">
                  <Form.Item
                    name="displayName"
                    label="姓名"
                    preserve={false}
                    rules={[{ required: true, message: "请输入姓名" }]}
                  >
                    <Input
                      placeholder="请输入真实姓名"
                      size="large"
                      maxLength={150}
                    />
                  </Form.Item>
                  <Form.Item
                    name="department"
                    label="单位或部门"
                    preserve={false}
                    rules={[{ required: true, message: "请输入单位或部门" }]}
                  >
                    <Input
                      placeholder="请输入单位或部门"
                      size="large"
                      maxLength={120}
                    />
                  </Form.Item>
                  <Form.Item
                    name="applicationReason"
                    label="申请说明"
                    preserve={false}
                    rules={[{ required: true, message: "请输入申请说明" }]}
                  >
                    <Input.TextArea
                      placeholder="请简要说明需要上传、导出或科研分析权限的用途"
                      autoSize={{ minRows: 2, maxRows: 3 }}
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>
                </div>
              ) : null}
              <Alert
                type="info"
                showIcon
                title={
                  accountPurpose === "research"
                    ? "注册后先按普通用户权限使用，科研权限审核通过后生效。"
                    : "注册成功后自动加入普通用户角色。"
                }
              />
              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: "请输入密码" },
                  { min: 6, message: "密码长度至少 6 位" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ fontSize: 16 }} />}
                  placeholder="请输入密码"
                  autoComplete="new-password"
                  size="large"
                />
              </Form.Item>
              <Form.Item
                name="passwordConfirm"
                label="确认密码"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "请再次输入密码" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("两次输入的密码不一致"));
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ fontSize: 16 }} />}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  size="large"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submittingAction === "register"}
                disabled={isSubmitting && submittingAction !== "register"}
                icon={<LoginOutlined style={{ fontSize: 16 }} />}
                size="large"
              >
                注册并进入
              </Button>
              <Button
                type="link"
                block
                disabled={isSubmitting}
                onClick={() => setMode("login")}
              >
                返回登录
              </Button>
            </Form>
          )}
        </Card>
      </BorderBeam>
    </main>
  );
}

type FormValidationError = {
  errorFields: { errors: string[] }[];
};

function firstFormError(errorInfo: FormValidationError, fallback: string) {
  const firstError = errorInfo.errorFields[0]?.errors[0];
  return firstError || fallback;
}
