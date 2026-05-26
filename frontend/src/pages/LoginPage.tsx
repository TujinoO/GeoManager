import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Checkbox, Form, Input, Typography } from 'antd';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import type { Bootstrap, User } from '../types';

interface LoginFormValues {
  username: string;
  password: string;
  remember?: boolean;
}

interface Props {
  bootstrap: Bootstrap;
  onLogin: (user: User) => void;
}

export default function LoginPage({ bootstrap, onLogin }: Props) {
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  async function handleFinish(values: LoginFormValues) {
    setSubmitting(true);
    try {
      await api.csrf();
      const response = await api.login(values.username, values.password, Boolean(values.remember));
      onLogin(response.user);
      message.success('登录成功');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
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
        <Typography.Title level={2}>用户登录</Typography.Title>
        <Typography.Text type="secondary">登录后进入地图工作台，后台功能按权限显示。</Typography.Text>

        <Form<LoginFormValues>
          className="login-form"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={handleFinish}
          requiredMark={false}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="请输入账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>
          <div className="login-options">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住登录状态</Checkbox>
            </Form.Item>
            <Button type="link" size="small">
              忘记密码
            </Button>
          </div>
          {!bootstrap.allowRegistration && <Alert type="info" showIcon message="当前系统未开放自助注册" />}
          <Button type="primary" htmlType="submit" block loading={submitting} icon={<LogIn size={16} />}>
            登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}
