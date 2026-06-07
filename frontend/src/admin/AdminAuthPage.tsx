import {
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { ProColumns } from "@ant-design/pro-components";
import { ProCard, ProTable } from "@ant-design/pro-components";
import {
  App,
  Button,
  Checkbox,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { AdminPermissionItem, Group, User } from "../types";

export default function AdminAuthPage() {
  const { message } = App.useApp();
  const { user } = useAppContext();
  const canCreateUser = Boolean(user?.permissions.canCreateUser);
  const canManagePermissions = Boolean(
    user?.permissions.canManageFeaturePermissions,
  );
  const [createGroupForm] = Form.useForm<{ name: string }>();
  const [createUserForm] = Form.useForm<{
    username: string;
    password: string;
    displayName?: string;
    email?: string;
    department?: string;
    groupIds?: number[];
    isActive?: boolean;
  }>();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<
    AdminPermissionItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [groupUser, setGroupUser] = useState<User | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string[]>>({});

  const loadAuthData = useCallback(async () => {
    if (!canCreateUser && !canManagePermissions) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [userData, groupData] = await Promise.all([
        api.adminUsers(),
        api.adminGroups(),
      ]);
      setUsers(userData.items);
      setGroups(groupData.items);
      setAvailablePermissions(groupData.availablePermissions);
      setGroupDrafts(
        Object.fromEntries(
          groupData.items.map((group) => [group.id, group.permissions]),
        ),
      );
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "认证授权数据加载失败",
      );
    } finally {
      setLoading(false);
    }
  }, [canCreateUser, canManagePermissions, message]);

  useEffect(() => {
    loadAuthData();
  }, [loadAuthData]);

  const groupNameById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );
  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        label: group.name,
        value: group.id,
        disabled: isSuperadminGroup(group),
      })),
    [groups],
  );
  const availablePermissionGroups = useMemo(() => {
    const permissionGroups = new Map<string, AdminPermissionItem[]>();
    for (const permission of availablePermissions) {
      const current = permissionGroups.get(permission.group) ?? [];
      current.push(permission);
      permissionGroups.set(permission.group, current);
    }
    return [...permissionGroups.entries()].map(([group, items]) => ({
      group,
      items,
    }));
  }, [availablePermissions]);

  const userColumns: ProColumns<User>[] = [
    {
      title: "用户名",
      dataIndex: "username",
      width: 150,
      fixed: "left",
      render: (_, record) => (
        <Button type="link" onClick={() => setActiveUser(record)}>
          {record.username}
        </Button>
      ),
    },
    {
      title: "显示名称",
      dataIndex: "displayName",
      width: 150,
      ellipsis: true,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      width: 220,
      ellipsis: true,
    },
    {
      title: "部门",
      dataIndex: "department",
      width: 160,
      ellipsis: true,
    },
    {
      title: "用户组",
      dataIndex: "groupIds",
      width: 260,
      search: false,
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          {record.groupIds.length > 0 ? (
            record.groupIds.map((groupId) => (
              <Tag key={groupId} color="green">
                {groupNameById.get(groupId) ?? `#${groupId}`}
              </Tag>
            ))
          ) : (
            <Tag>未分组</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "isActive",
      valueType: "select",
      width: 120,
      valueEnum: {
        true: { text: "启用", status: "Success" },
        false: { text: "停用", status: "Error" },
      },
      render: (_, record) =>
        record.isActive ? (
          <Tag color="success">启用</Tag>
        ) : (
          <Tag color="error">停用</Tag>
        ),
    },
    {
      title: "操作",
      valueType: "option",
      width: 190,
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setActiveUser(record)}
        >
          查看
        </Button>,
        <Button
          key="groups"
          type="link"
          icon={<TeamOutlined />}
          disabled={!canManagePermissions}
          onClick={() => {
            setGroupUser(record);
            setSelectedGroupIds(record.groupIds);
          }}
        >
          用户组
        </Button>,
      ],
    },
  ];

  const userStats = useMemo(
    () => ({
      active: users.filter((user) => user.isActive).length,
      disabled: users.filter((user) => !user.isActive).length,
      groups: groups.length,
    }),
    [groups.length, users],
  );

  async function handleCreateGroup() {
    if (!canManagePermissions) return;
    try {
      const values = await createGroupForm.validateFields();
      const group = await api.createAdminGroup({
        name: values.name,
        permissions: [],
      });
      setGroups((current) => [...current, group]);
      setGroupDrafts((current) => ({
        ...current,
        [group.id]: group.permissions,
      }));
      createGroupForm.resetFields();
      setCreateGroupOpen(false);
      message.success("用户组已创建");
    } catch (error) {
      message.error(formOrApiError(error, "用户组创建失败"));
    }
  }

  async function handleCreateUser() {
    if (!canCreateUser) return;
    try {
      const values = await createUserForm.validateFields();
      const result = await api.createAdminUser({
        username: values.username,
        displayName: values.displayName ?? "",
        email: values.email ?? "",
        department: values.department ?? "",
        groupIds: values.groupIds as [number, ...number[]],
        isActive: values.isActive ?? true,
      });
      createUserForm.resetFields();
      setCreateUserOpen(false);
      if (result.generatedPassword) {
        Modal.success({
          title: "用户创建成功",
          content: (
            <div>
              <p>
                用户 <strong>{result.username}</strong> 已创建成功。
              </p>
              <p>
                初始密码：
                <Typography.Text copyable>
                  {result.generatedPassword}
                </Typography.Text>
              </p>
              <p>请妥善保存此密码，关闭后将无法再次查看。</p>
            </div>
          ),
        });
      } else {
        message.success("用户已创建");
      }
      await loadAuthData();
    } catch (error) {
      message.error(formOrApiError(error, "用户创建失败"));
    }
  }

  async function handleSaveGroup(group: Group) {
    if (!canManagePermissions || group.isProtected) return;
    const updated = await api.updateAdminGroup(group.id, {
      permissions: groupDrafts[group.id] ?? [],
    });
    setGroups((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setGroupDrafts((current) => ({
      ...current,
      [updated.id]: updated.permissions,
    }));
    message.success(`${updated.name}权限已保存`);
  }

  async function handleDeleteGroup(group: Group) {
    if (!canManagePermissions || group.isProtected) return;
    await api.deleteAdminGroup(group.id);
    setGroups((current) => current.filter((item) => item.id !== group.id));
    setGroupDrafts((current) => {
      const next = { ...current };
      delete next[group.id];
      return next;
    });
    message.success("用户组已删除");
  }

  async function handleSaveUserGroups() {
    if (!groupUser || !canManagePermissions) return;
    const updated = await api.updateAdminUserGroups(groupUser.id, {
      groupIds: selectedGroupIds as [number, ...number[]],
    });
    setUsers((current) =>
      current.map((user) => (user.id === updated.id ? updated : user)),
    );
    setGroupUser(null);
    message.success("用户组归属已保存");
    await loadAuthData();
  }

  if (!canCreateUser && !canManagePermissions) {
    return <Result status="403" title="无权限访问认证授权" />;
  }

  const tabs = [
    {
      key: "users",
      label: "用户管理",
      children: (
        <Spin spinning={loading}>
          <div className="admin-page-stack">
            <ProCard.Group gutter={16} className="admin-stat-row">
              <ProCard title="启用账号">
                <Typography.Title level={2}>
                  {userStats.active}
                </Typography.Title>
              </ProCard>
              <ProCard title="停用账号">
                <Typography.Title level={2}>
                  {userStats.disabled}
                </Typography.Title>
              </ProCard>
              <ProCard title="用户组数量">
                <Typography.Title level={2}>
                  {userStats.groups}
                </Typography.Title>
              </ProCard>
            </ProCard.Group>
            {canCreateUser ? (
              <div className="admin-toolbar">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    createUserForm.setFieldsValue({ isActive: true });
                    setCreateUserOpen(true);
                  }}
                >
                  新建用户
                </Button>
              </div>
            ) : null}
            <ProTable<User>
              className="admin-table"
              rowKey="id"
              headerTitle="用户列表"
              columns={userColumns}
              dataSource={users}
              cardBordered
              options={false}
              pagination={false}
              scroll={{ x: 1320 }}
              search={false}
            />
          </div>
        </Spin>
      ),
    },
    ...(canManagePermissions
      ? [
          {
            key: "groups",
            label: "用户组权限",
            children: (
              <Spin spinning={loading}>
                <div className="admin-page-stack">
                  <div className="admin-toolbar">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateGroupOpen(true)}
                    >
                      新建用户组
                    </Button>
                  </div>
                  <div className="admin-role-grid">
                    {groups.map((group) => (
                      <ProCard
                        key={group.id}
                        title={group.name}
                        extra={
                          <Space>
                            {group.isProtected ? (
                              <Tag color="gold">受保护</Tag>
                            ) : null}
                            <Tag color="blue">{group.userCount} 人</Tag>
                          </Space>
                        }
                      >
                        <Checkbox.Group
                          className="admin-permission-list"
                          value={groupDrafts[group.id] ?? group.permissions}
                          onChange={(values) => {
                            setGroupDrafts((current) => ({
                              ...current,
                              [group.id]: values.map(String),
                            }));
                          }}
                        >
                          {availablePermissionGroups.map((permissionGroup) => (
                            <div
                              className="admin-permission-group"
                              key={permissionGroup.group}
                            >
                              <Typography.Text strong>
                                {permissionGroup.group}
                              </Typography.Text>
                              <div className="admin-permission-group-options">
                                {permissionGroup.items.map((permission) => (
                                  <Checkbox
                                    key={permission.id}
                                    value={permission.id}
                                    disabled={group.isProtected}
                                  >
                                    <span className="admin-permission-option">
                                      <Typography.Text strong>
                                        {permission.label}
                                      </Typography.Text>
                                      <Typography.Text type="secondary">
                                        {permission.id}
                                      </Typography.Text>
                                    </span>
                                  </Checkbox>
                                ))}
                              </div>
                            </div>
                          ))}
                        </Checkbox.Group>
                        {availablePermissions.length === 0 ? (
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : null}
                        <div className="admin-card-actions">
                          <Space>
                            <Button
                              icon={<SaveOutlined />}
                              disabled={group.isProtected}
                              onClick={() => handleSaveGroup(group)}
                            >
                              保存权限
                            </Button>
                            {group.userCount === 0 && !group.isProtected ? (
                              <Popconfirm
                                title="确认删除空用户组？"
                                description="删除前请确认该用户组没有关联用户。"
                                onConfirm={() => handleDeleteGroup(group)}
                              >
                                <Button danger icon={<DeleteOutlined />}>
                                  删除
                                </Button>
                              </Popconfirm>
                            ) : (
                              <Button danger icon={<DeleteOutlined />} disabled>
                                删除
                              </Button>
                            )}
                          </Space>
                        </div>
                      </ProCard>
                    ))}
                  </div>
                </div>
              </Spin>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="admin-page-stack">
      <Tabs className="admin-auth-tabs" items={tabs} />

      <Drawer
        title="用户详情"
        open={Boolean(activeUser)}
        onClose={() => setActiveUser(null)}
        size="large"
      >
        {activeUser ? (
          <div className="admin-user-drawer">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {activeUser.displayName}
            </Typography.Title>
            <Typography.Text type="secondary">
              {activeUser.email}
            </Typography.Text>
            <dl>
              <dt>用户名</dt>
              <dd>{activeUser.username}</dd>
              <dt>部门</dt>
              <dd>{activeUser.department || "未设置"}</dd>
              <dt>状态</dt>
              <dd>
                {activeUser.isActive ? (
                  <Tag color="success">启用</Tag>
                ) : (
                  <Tag color="error">停用</Tag>
                )}
              </dd>
              <dt>用户组</dt>
              <dd>
                <Space size={[6, 6]} wrap>
                  {activeUser.groupIds.length > 0 ? (
                    activeUser.groupIds.map((groupId) => (
                      <Tag key={groupId} color="green">
                        {groupNameById.get(groupId) ?? `#${groupId}`}
                      </Tag>
                    ))
                  ) : (
                    <Tag>未分组</Tag>
                  )}
                </Space>
              </dd>
            </dl>
          </div>
        ) : (
          <Empty />
        )}
      </Drawer>

      <Drawer
        title="设置用户组"
        open={Boolean(groupUser)}
        onClose={() => setGroupUser(null)}
        extra={
          <Button type="primary" onClick={handleSaveUserGroups}>
            保存
          </Button>
        }
      >
        {groupUser ? (
          <div className="admin-page-stack">
            <Typography.Text strong>{groupUser.displayName}</Typography.Text>
            <Select
              mode="multiple"
              value={selectedGroupIds}
              options={groups.map((group) => ({
                label: group.name,
                value: group.id,
                disabled:
                  isSuperadminGroup(group) &&
                  !groupUser.groupIds.includes(group.id),
              }))}
              onChange={setSelectedGroupIds}
              style={{ width: "100%" }}
            />
          </div>
        ) : null}
      </Drawer>

      <Modal
        title="新建用户组"
        open={createGroupOpen}
        onOk={handleCreateGroup}
        onCancel={() => setCreateGroupOpen(false)}
        destroyOnHidden
      >
        <Form form={createGroupForm} layout="vertical">
          <Form.Item
            name="name"
            label="用户组名称"
            rules={[{ required: true, message: "请输入用户组名称" }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建用户"
        open={createUserOpen}
        onOk={handleCreateUser}
        onCancel={() => setCreateUserOpen(false)}
        destroyOnHidden
      >
        <Form
          form={createUserForm}
          layout="vertical"
          initialValues={{ isActive: true, groupIds: [] }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          <Form.Item
            name="groupIds"
            label="用户组"
            rules={[{ required: true, message: "请选择用户组" }]}
          >
            <Select mode="multiple" options={groupOptions} />
          </Form.Item>
          <Form.Item name="displayName" label="显示名称">
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: "email", message: "请输入有效邮箱" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input />
          </Form.Item>
          <Form.Item name="isActive" label="启用账号" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

type FormValidationError = {
  errorFields?: { errors: string[] }[];
};

function formOrApiError(error: unknown, fallback: string) {
  if (isFormValidationError(error)) {
    return error.errorFields?.[0]?.errors[0] ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

function isFormValidationError(error: unknown): error is FormValidationError {
  return typeof error === "object" && error !== null && "errorFields" in error;
}

function isSuperadminGroup(group: Group) {
  return group.name === "超级管理员";
}
