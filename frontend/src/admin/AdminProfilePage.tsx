import {
  LockOutlined,
  StopOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { ProDescriptionsItemProps } from "@ant-design/pro-components";
import { ProCard, ProDescriptions } from "@ant-design/pro-components";
import {
  App,
  Avatar,
  Button,
  Form,
  Input,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { Key } from "react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminProfile,
  AdminProfilePasswordUpdate,
  AdminProfileUpdate,
} from "../types";

interface ProfileDescriptionItem {
  username: string;
  displayName: string;
  roles: string[];
  department: string;
  email: string;
}

const profileDescriptionColumns: ProDescriptionsItemProps<ProfileDescriptionItem>[] =
  [
    {
      title: "用户名",
      dataIndex: "username",
      tooltip: "用户名在创建时确定，不可修改",
      editable: false,
    },
    {
      title: "显示名称",
      dataIndex: "displayName",
    },
    {
      title: "用户组",
      dataIndex: "roles",
      editable: false,
      render: (_, entity) =>
        entity.roles && entity.roles.length > 0 ? (
          <Space size={[8, 8]} wrap>
            {entity.roles.map((role) => (
              <Tag key={role} color="blue">
                {role}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未分配用户组</Typography.Text>
        ),
    },
    {
      title: "部门",
      dataIndex: "department",
    },
    {
      title: "邮箱",
      dataIndex: "email",
      copyable: true,
      formItemProps: {
        rules: [{ type: "email", message: "请输入有效邮箱" }],
      },
    },
  ];

const accessAdminPermission = "core.access_admin";

function getCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export default function AdminProfilePage() {
  const { message } = App.useApp();
  const { setUser } = useAppContext();
  const [passwordForm] = Form.useForm<AdminProfilePasswordUpdate>();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const data = await api.adminProfile();
        if (!mounted) return;
        setProfile(data);
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
  }, [message]);

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
    message.success("个人信息已保存");
    return true;
  }

  async function handleProfileDescriptionSave(
    _key: Key | Key[],
    values: ProfileDescriptionItem,
  ) {
    await handleProfileSave({
      ...values,
      avatarUrl: profile?.avatarUrl ?? "",
    });
  }

  async function handlePermissionChange(
    permissionId: string,
    enabled: boolean,
  ) {
    if (!profile) return;
    if (isLockedProfilePermission(profile, permissionId) && !enabled) {
      message.warning("超级管理员不能关闭后台访问权限");
      return;
    }
    const disabledPermissions = new Set(profile.disabledPermissions);
    if (enabled) {
      disabledPermissions.delete(permissionId);
    } else {
      disabledPermissions.add(permissionId);
    }
    try {
      const updated = await api.updateAdminProfilePermissions({
        disabledPermissions: [...disabledPermissions],
      });
      setProfile(updated);
      setUser(updated.user);
      message.success("权限偏好已更新");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "权限偏好更新失败",
      );
    }
  }

  async function handlePasswordSave(values: AdminProfilePasswordUpdate) {
    try {
      await api.updateAdminProfilePassword(values);
      passwordForm.resetFields();
      message.success("密码已更新");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "密码更新失败");
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: antd Upload customRequest type
  const handleAvatarUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await fetch("/api/admin/profile/avatar/", {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRFToken": getCookie("csrftoken") ?? "",
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "上传失败");
      }

      const updated = await response.json();
      setProfile(updated);
      setUser(updated.user);
      onSuccess?.(updated);
      message.success("头像上传成功");
    } catch (error) {
      onError?.(error as Error);
      message.error(error instanceof Error ? error.message : "头像上传失败");
    } finally {
      setAvatarUploading(false);
    }
  };

  if (loading) {
    return (
      <ProCard className="admin-section-card">
        <Skeleton active paragraph={{ rows: 8 }} />
      </ProCard>
    );
  }

  const grantedPermissions = new Set(profile?.grantedPermissions ?? []);
  const disabledPermissions = new Set(profile?.disabledPermissions ?? []);
  const profileDescriptionData: ProfileDescriptionItem = {
    username: profile?.user.username ?? "",
    displayName: profile?.user.displayName ?? "",
    roles: profile?.user.roles ?? [],
    email: profile?.user.email ?? "",
    department: profile?.department ?? "",
  };

  return (
    <div className="admin-page-stack">
      <ProCard title="个人信息" className="admin-section-card">
        <div className="admin-profile-shell">
          <Upload
            name="avatar"
            showUploadList={false}
            customRequest={handleAvatarUpload}
            beforeUpload={(file) => {
              const isJpgOrPng =
                file.type === "image/jpeg" || file.type === "image/png";
              if (!isJpgOrPng) {
                message.error("仅支持 JPG/PNG 格式的图片");
              }
              const isLt2M = file.size / 1024 / 1024 < 2;
              if (!isLt2M) {
                message.error("图片大小不能超过 2 MB");
              }
              return isJpgOrPng && isLt2M;
            }}
            disabled={avatarUploading}
          >
            <div className="admin-avatar-wrapper admin-avatar-editable">
              <Avatar
                size={88}
                src={profile?.avatarUrl || undefined}
                icon={<UserOutlined />}
              />
              <div className="admin-avatar-overlay">
                <UploadOutlined />
                <span>{avatarUploading ? "上传中..." : "更换头像"}</span>
              </div>
            </div>
          </Upload>
          <ProDescriptions<ProfileDescriptionItem>
            className="admin-profile-descriptions"
            column={2}
            columns={profileDescriptionColumns}
            dataSource={profileDescriptionData}
            editable={{
              onSave: handleProfileDescriptionSave,
            }}
            emptyText="未填写"
          />
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

      <ProCard title="修改密码" className="admin-section-card">
        <Form
          form={passwordForm}
          layout="vertical"
          className="admin-password-form"
          onFinish={handlePasswordSave}
          onFinishFailed={(errorInfo) => {
            message.error(firstFormError(errorInfo, "请检查密码信息"));
          }}
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              {
                validator: (_, value: string | undefined) => {
                  const password = value ?? "";
                  if (!password) return Promise.resolve();
                  if (password.length < 6) {
                    return Promise.reject(new Error("密码长度至少 6 位"));
                  }
                  if (password.length > 16) {
                    return Promise.reject(new Error("密码长度不能超过 16 位"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="passwordConfirm"
            label="确认新密码"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请再次输入新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的新密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" icon={<LockOutlined />}>
            更新密码
          </Button>
        </Form>
      </ProCard>
    </div>
  );
}

type FormValidationError = {
  errorFields: { errors: string[] }[];
};

function firstFormError(errorInfo: FormValidationError, fallback: string) {
  const firstError = errorInfo.errorFields[0]?.errors[0];
  return firstError || fallback;
}

function isLockedProfilePermission(
  profile: AdminProfile | null,
  permissionId: string,
) {
  return (
    permissionId === accessAdminPermission &&
    Boolean(profile?.user.permissions.canAccessAdmin)
  );
}
