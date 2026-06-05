import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Typography,
} from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { LoginFormValues, RegisterFormValues } from "../types";

export default function LoginPage() {
  const { bootstrap, setUser } = useAppContext();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true);
    try {
      await api.csrf();
      const response = await api.login(
        values.username,
        values.password,
        Boolean(values.remember),
      );
      setUser(response.user);
      message.success("登录成功");
      navigate("/", { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(values: RegisterFormValues) {
    setSubmitting(true);
    try {
      await api.csrf();
      const response = await api.register(
        values.username,
        values.email ?? "",
        values.password,
        values.passwordConfirm,
      );
      setUser(response.user);
      message.success(response.detail);
      navigate("/", { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-identity">
        <div className="login-mark">Populus</div>
        <Typography.Title level={1}>{bootstrap.systemName}</Typography.Title>
        <p>统一数据入口 · 空间图层管理 · 栅格后台出图 · 成果共享</p>
      </section>

      <Card className="login-card" variant="borderless">
        <Typography.Title level={2}>
          {mode === "login" ? "用户登录" : "用户注册"}
        </Typography.Title>
        <Typography.Text type="secondary">
          {mode === "login"
            ? "登录后进入地图工作台，后台功能按权限显示。"
            : "首个注册用户自动成为系统管理员。"}
        </Typography.Text>

        {mode === "login" ? (
          <Form<LoginFormValues>
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
              />
            </Form.Item>
            <div className="login-options">
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住登录状态</Checkbox>
              </Form.Item>
              <Button type="link" size="small">
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
              loading={submitting}
              icon={<LoginOutlined style={{ fontSize: 16 }} />}
            >
              登录
            </Button>
            {bootstrap.allowRegistration && (
              <Button type="link" block onClick={() => setMode("register")}>
                注册新账号
              </Button>
            )}
          </Form>
        ) : (
          <Form<RegisterFormValues>
            className="login-form"
            layout="vertical"
            onFinish={handleRegister}
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
              />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ type: "email", message: "请输入有效邮箱" }]}
            >
              <Input placeholder="请输入邮箱" autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ fontSize: 16 }} />}
                placeholder="请输入密码"
                autoComplete="new-password"
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
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              icon={<LoginOutlined style={{ fontSize: 16 }} />}
            >
              注册并进入
            </Button>
            <Button type="link" block onClick={() => setMode("login")}>
              返回登录
            </Button>
          </Form>
        )}
      </Card>
    </main>
  );
}
