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
  Typography,
} from "antd";
import { useState } from "react";
import { api } from "../api/client";
import capfedLogoWhite from "../assets/capfed-logo-white.svg";
import { oceanBorderBeam } from "../components/oceanBorderBeam";
import { useAppContext } from "../contexts/AppContext";
import type { LoginFormValues, RegisterFormValues } from "../types";

const platformChineseName = "中亚胡杨林生态系统保护数据共享平台";
const platformEnglishName =
  "Central Asia Poplar Forest Ecosystem Data Platform";
const platformShortName = "CAPFED";
const platformEdition = "CAPFED-WebGIS Research Edition";
const platformVersion = "v1.0.0";

const loginStats = [
  {
    icon: <DatabaseOutlined style={{ fontSize: 18 }} />,
    label: "数据资源",
    note: "空间、表格、文档",
    value: "1,286",
  },
  {
    icon: <FundProjectionScreenOutlined style={{ fontSize: 18 }} />,
    label: "专题图层",
    note: "生态保护专题",
    value: "37",
  },
  {
    icon: <DeploymentUnitOutlined style={{ fontSize: 18 }} />,
    label: "监测站点",
    note: "长期观测网络",
    value: "94",
  },
  {
    icon: <EnvironmentOutlined style={{ fontSize: 18 }} />,
    label: "覆盖流域",
    note: "中亚重点区域",
    value: "12",
  },
] as const;

const capabilityTags = [
  "遥感影像",
  "矢量边界",
  "野外样方",
  "长期监测",
  "专题共享",
];

const stationStatuses = Array.from({ length: 24 }, (_, index) => {
  const position = index + 1;
  let state = "normal";
  if (position === 8 || position === 19) {
    state = "warning";
  }
  return { id: `station-${position}`, state };
});

const serviceStatusSummary = [
  {
    label: "正常",
    state: "normal",
    value: stationStatuses.filter((station) => station.state === "normal")
      .length,
  },
  {
    label: "待同步",
    state: "warning",
    value: stationStatuses.filter((station) => station.state === "warning")
      .length,
  },
  {
    label: "异常",
    state: "risk",
    value: stationStatuses.filter((station) => station.state === "risk").length,
  },
] as const;

export default function LoginPage() {
  const { bootstrap, setUser } = useAppContext();
  const { message } = App.useApp();
  const [submittingAction, setSubmittingAction] = useState<
    "login" | "register" | "guest" | null
  >(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const isSubmitting = submittingAction !== null;

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
      const response = await api.register(
        values.username,
        values.email ?? "",
        values.password,
        values.passwordConfirm,
      );
      setUser(response.user);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "注册失败");
      setSubmittingAction(null);
    }
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
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
                <small>{stat.note}</small>
              </div>
            </BorderBeam>
          ))}
        </div>

        <BorderBeam color={oceanBorderBeam}>
          <div className="login-ops-panel">
            <div className="login-ops-copy">
              <span>平台服务状态</span>
              <strong>资源目录已接入 · 图层服务可用 · 权限认证开启</strong>
              <small>
                登录后可按账号权限进入数据目录、地图工作台与后台管理功能。
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
                  <span key={item.state}>
                    <i data-state={item.state} />
                    {item.label} {item.value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </BorderBeam>

        <footer className="login-version-bar">
          <span>{platformEdition}</span>
          <span>{platformVersion}</span>
          <span>统计口径待接入后端平台概览接口</span>
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
                <Button type="link" size="small" disabled={isSubmitting}>
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
                登录并进入三维地球
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
                    onClick={() => setMode("register")}
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
              className="login-form"
              layout="vertical"
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
                rules={[{ type: "email", message: "请输入有效邮箱" }]}
              >
                <Input
                  placeholder="请输入邮箱"
                  autoComplete="email"
                  size="large"
                />
              </Form.Item>
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
