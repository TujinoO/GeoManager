import {
  CloseOutlined,
  EditOutlined,
  SaveOutlined,
  StopOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { ProCard, ProForm, ProFormText } from "@ant-design/pro-components";
import type { FormInstance } from "antd";
import {
  App,
  Avatar,
  Button,
  Form,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { AdminProfile, AdminProfileUpdate } from "../types";

export default function AdminProfilePage() {
  const { message } = App.useApp();
  const { setUser } = useAppContext();
  const [form] = Form.useForm<AdminProfileUpdate>();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const data = await api.adminProfile();
        if (!mounted) return;
        setProfile(data);
        form.setFieldsValue({
          username: data.user.username,
          displayName: data.user.displayName,
          email: data.user.email,
          avatarUrl: data.avatarUrl,
          department: data.department,
        });
      } catch (error) {
        message.error(
          error instanceof Error ? error.message : "用户资料加载失败",
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [form, message]);

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, AdminProfile["availablePermissions"]>();
    for (const permission of profile?.availablePermissions ?? []) {
      const current = groups.get(permission.group) ?? [];
      current.push(permission);
      groups.set(permission.group, current);
    }
    return [...groups.entries()].map(([group, items]) => ({ group, items }));
  }, [profile]);

  async function handleProfileSave(values: AdminProfileUpdate) {
    const updated = await api.updateAdminProfile(values);
    setProfile(updated);
    setUser(updated.user);
    setProfileFields(form, updated);
    setEditing(false);
    message.success("个人信息已保存");
    return true;
  }

  async function handlePermissionChange(
    permissionId: string,
    enabled: boolean,
  ) {
    if (!profile) return;
    const disabledPermissions = new Set(profile.disabledPermissions);
    if (enabled) {
      disabledPermissions.delete(permissionId);
    } else {
      disabledPermissions.add(permissionId);
    }
    const updated = await api.updateAdminProfilePermissions({
      disabledPermissions: [...disabledPermissions],
    });
    setProfile(updated);
    setUser(updated.user);
    message.success("权限偏好已更新");
  }

  if (loading) {
    return (
      <ProCard className="admin-section-card">
        <Skeleton active paragraph={{ rows: 8 }} />
      </ProCard>
    );
  }

  const grantedPermissions = new Set(profile?.grantedPermissions ?? []);
  const disabledPermissions = new Set(profile?.disabledPermissions ?? []);

  return (
    <div className="admin-page-stack">
      <ProCard
        title="个人信息"
        className="admin-section-card"
        extra={
          editing ? (
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={() => {
                if (profile) {
                  setProfileFields(form, profile);
                }
                setEditing(false);
              }}
            >
              取消
            </Button>
          ) : (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditing(true)}
            >
              编辑
            </Button>
          )
        }
      >
        <div className="admin-profile-shell">
          <Avatar
            size={88}
            src={profile?.avatarUrl || undefined}
            icon={<UserOutlined />}
          />
          <ProForm<AdminProfileUpdate>
            form={form}
            layout="horizontal"
            grid
            className="admin-profile-form"
            readonly={!editing}
            onFinish={handleProfileSave}
            submitter={
              editing
                ? {
                    searchConfig: {
                      submitText: "保存信息",
                      resetText: "重置",
                    },
                    submitButtonProps: {
                      icon: <SaveOutlined />,
                    },
                  }
                : false
            }
          >
            <ProFormText
              name="username"
              label="用户名"
              colProps={{ xs: 24, md: 12 }}
              rules={[{ required: true, message: "请输入用户名" }]}
            />
            <ProFormText
              name="displayName"
              label="显示名称"
              colProps={{ xs: 24, md: 12 }}
            />
            <ProFormText
              name="email"
              label="邮箱"
              colProps={{ xs: 24, md: 12 }}
              rules={[{ type: "email", message: "请输入有效邮箱" }]}
            />
            <ProFormText
              name="department"
              label="部门"
              colProps={{ xs: 24, md: 12 }}
            />
            <ProFormText
              name="avatarUrl"
              label="头像 URL"
              colProps={{ xs: 24 }}
            />
          </ProForm>
        </div>
      </ProCard>

      <ProCard title="我的权限" className="admin-section-card">
        <div className="admin-permission-groups">
          {permissionGroups.map(({ group, items }) => (
            <section key={group} className="admin-permission-group">
              <Typography.Title level={5}>{group}</Typography.Title>
              <div className="admin-permission-switch-list">
                {items.map((permission) => {
                  const granted = grantedPermissions.has(permission.id);
                  const enabled =
                    granted && !disabledPermissions.has(permission.id);
                  return (
                    <div key={permission.id} className="admin-permission-row">
                      <Space orientation="vertical" size={2}>
                        <Typography.Text strong>
                          {permission.label}
                        </Typography.Text>
                        <Typography.Text type="secondary">
                          {permission.id}
                        </Typography.Text>
                      </Space>
                      <Space>
                        {granted ? (
                          <Tag color={enabled ? "green" : "orange"}>
                            {enabled ? "已开启" : "已关闭"}
                          </Tag>
                        ) : (
                          <Tag icon={<StopOutlined />}>未授予</Tag>
                        )}
                        <Switch
                          checked={enabled}
                          disabled={!granted}
                          onChange={(checked) =>
                            handlePermissionChange(permission.id, checked)
                          }
                        />
                      </Space>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </ProCard>
    </div>
  );
}

function setProfileFields(
  form: FormInstance<AdminProfileUpdate>,
  profile: AdminProfile,
) {
  form.setFieldsValue({
    username: profile.user.username,
    displayName: profile.user.displayName,
    email: profile.user.email,
    avatarUrl: profile.avatarUrl,
    department: profile.department,
  });
}
