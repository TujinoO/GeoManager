import {
  DeleteOutlined,
  EllipsisOutlined,
  EyeOutlined,
  KeyOutlined,
  PlusOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import type { ProColumns } from "@ant-design/pro-components";
import { ProCard, ProTable } from "@ant-design/pro-components";
import type { MenuProps } from "antd";
import {
  App,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
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
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type {
  AdminOperationLog,
  AdminPermissionItem,
  Group,
  User,
} from "../types";

const operationResultText: Record<string, string> = {
  success: "成功",
  warning: "告警",
  failed: "失败",
};

const operationResultColor: Record<string, string> = {
  success: "success",
  warning: "warning",
  failed: "error",
};

export default function AdminAuthPage() {
  const { message, modal } = App.useApp();
  const { user } = useAppContext();
  const location = useLocation();
  const activeSection = location.pathname.endsWith("/groups")
    ? "groups"
    : "users";
  const canManageAuth = Boolean(user?.permissions.canManageAuth);
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
  const [logUser, setLogUser] = useState<User | null>(null);
  const [groupUser, setGroupUser] = useState<User | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<Record<number, string[]>>({});
  const [permissionGroup, setPermissionGroup] = useState<Group | null>(null);

  const loadAuthData = useCallback(async () => {
    if (!canManageAuth) {
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
  }, [canManageAuth, message]);

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
  const permissionLabelById = useMemo(
    () =>
      new Map(
        availablePermissions.map((permission) => [
          permission.id,
          permission.label,
        ]),
      ),
    [availablePermissions],
  );

  const userColumns: ProColumns<User>[] = [
    {
      title: "账号",
      dataIndex: "username",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Button
            className="admin-user-link"
            type="link"
            onClick={() => setActiveUser(record)}
          >
            {record.username}
          </Button>
          <Typography.Text type="secondary" ellipsis>
            {record.displayName || "未设置显示名"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "联系信息",
      dataIndex: "email",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text ellipsis>
            {record.email || "未设置邮箱"}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis>
            {record.department || "未设置部门"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "用户组",
      dataIndex: "groupIds",
      width: 210,
      search: false,
      render: (_, record) => (
        <GroupTags
          groupIds={record.groupIds}
          groupNameById={groupNameById}
          maxVisible={2}
        />
      ),
    },
    {
      title: "状态",
      dataIndex: "isActive",
      valueType: "select",
      width: 88,
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
      width: 120,
      render: (_, record) => [
        <Button
          key="detail"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setLogUser(record)}
        >
          查看
        </Button>,
        <Dropdown
          key="actions"
          trigger={["click"]}
          menu={{
            items: userActionItems(record),
            onClick: ({ key }) => handleUserAction(key, record),
          }}
        >
          <Button type="link" icon={<EllipsisOutlined />}>
            操作
          </Button>
        </Dropdown>,
      ],
    },
  ];

  const userLogColumns: ProColumns<AdminOperationLog>[] = [
    {
      title: "操作时间",
      dataIndex: "occurredAt",
      width: 180,
      render: (_, record) => record.occurredAt,
    },
    {
      title: "模块",
      dataIndex: "module",
      width: 120,
      ellipsis: true,
    },
    {
      title: "动作",
      dataIndex: "action",
      width: 140,
      ellipsis: true,
    },
    {
      title: "结果",
      dataIndex: "result",
      width: 88,
      render: (_, record) => (
        <Tag color={operationResultColor[record.result] ?? "default"}>
          {operationResultText[record.result] ?? record.result}
        </Tag>
      ),
    },
    {
      title: "摘要",
      dataIndex: "summary",
      width: 280,
      ellipsis: true,
    },
  ];

  const groupColumns: ProColumns<Group>[] = [
    {
      title: "用户组",
      dataIndex: "name",
      width: "24%",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.name}</Typography.Text>
          <Space size={[6, 6]} wrap>
            <Tag color="blue">{record.userCount} 人</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: "已授予权限",
      dataIndex: "permissions",
      width: "56%",
      search: false,
      render: (_, record) =>
        record.permissions.length > 0 ? (
          <PermissionTags
            permissionIds={record.permissions}
            permissionLabelById={permissionLabelById}
            maxVisible={6}
          />
        ) : (
          <Typography.Text type="secondary">暂未授予功能权限</Typography.Text>
        ),
    },
    {
      title: "操作",
      valueType: "option",
      width: "20%",
      render: (_, record) => [
        <Button
          key="permissions"
          type="link"
          icon={<EyeOutlined />}
          disabled={!canEditGroupPermissions(record)}
          onClick={() => openPermissionDrawer(record)}
        >
          权限
        </Button>,
        record.userCount === 0 && !record.isProtected ? (
          <Popconfirm
            key="delete"
            title="确认删除空用户组？"
            description="删除前请确认该用户组没有关联用户。"
            onConfirm={() => handleDeleteGroup(record)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ) : (
          <Button
            key="delete"
            type="link"
            danger
            icon={<DeleteOutlined />}
            disabled
          >
            删除
          </Button>
        ),
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
        showGeneratedPasswordModal({
          title: "用户创建成功",
          username: result.username,
          password: result.generatedPassword,
        });
      } else {
        message.success("用户已创建");
      }
      await loadAuthData();
    } catch (error) {
      message.error(formOrApiError(error, "用户创建失败"));
    }
  }

  function openUserGroupDrawer(targetUser: User) {
    setGroupUser(targetUser);
    setSelectedGroupIds(targetUser.groupIds);
  }

  function userActionItems(record: User): MenuProps["items"] {
    return [
      {
        key: "groups",
        icon: <TeamOutlined />,
        label: "更改用户组",
      },
      {
        key: "status",
        icon: <StopOutlined />,
        label: record.isActive ? "停用" : "启用",
        disabled: record.id === user?.id,
      },
      {
        key: "resetPassword",
        icon: <KeyOutlined />,
        label: "重置密码",
        disabled: record.id === user?.id,
      },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        label: "删除",
        danger: true,
        disabled: record.id === user?.id,
      },
    ];
  }

  function handleUserAction(key: string, targetUser: User) {
    if (key === "groups") {
      openUserGroupDrawer(targetUser);
      return;
    }
    if (key === "status") {
      handleToggleUserStatus(targetUser);
      return;
    }
    if (key === "resetPassword") {
      handleResetUserPassword(targetUser);
      return;
    }
    if (key === "delete") {
      handleDeleteUser(targetUser);
    }
  }

  function showGeneratedPasswordModal({
    title,
    username,
    password,
  }: {
    title: string;
    username: string;
    password: string;
  }) {
    Modal.success({
      title,
      content: (
        <div>
          <p>
            用户 <strong>{username}</strong> 的密码已生成。
          </p>
          <p>
            新密码：
            <Typography.Text copyable>{password}</Typography.Text>
          </p>
          <p>请妥善保存此密码，关闭后将无法再次查看。</p>
        </div>
      ),
    });
  }

  function handleToggleUserStatus(targetUser: User) {
    const nextActive = !targetUser.isActive;
    modal.confirm({
      title: nextActive ? "确认启用用户？" : "确认停用用户？",
      content: `${targetUser.displayName || targetUser.username} 将被${
        nextActive ? "启用" : "停用"
      }。`,
      okText: nextActive ? "启用" : "停用",
      okButtonProps: { danger: !nextActive },
      cancelText: "取消",
      onOk: async () => {
        const updated = await api.updateAdminUser(targetUser.id, {
          isActive: nextActive,
        });
        setUsers((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        message.success(nextActive ? "用户已启用" : "用户已停用");
      },
    });
  }

  function handleDeleteUser(targetUser: User) {
    modal.confirm({
      title: "确认删除用户？",
      content: `删除 ${targetUser.displayName || targetUser.username} 后无法恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        await api.deleteAdminUser(targetUser.id);
        setUsers((current) =>
          current.filter((item) => item.id !== targetUser.id),
        );
        message.success("用户已删除");
      },
    });
  }

  function handleResetUserPassword(targetUser: User) {
    modal.confirm({
      title: "确认重置密码？",
      content: `${targetUser.displayName || targetUser.username} 的当前密码将失效。`,
      okText: "重置",
      cancelText: "取消",
      onOk: async () => {
        const result = await api.resetAdminUserPassword(targetUser.id);
        showGeneratedPasswordModal({
          title: "密码重置成功",
          username: result.username,
          password: result.generatedPassword,
        });
      },
    });
  }

  function openPermissionDrawer(group: Group) {
    setGroupDrafts((current) => ({
      ...current,
      [group.id]: current[group.id] ?? group.permissions,
    }));
    setPermissionGroup(group);
  }

  function closePermissionDrawer() {
    setPermissionGroup(null);
  }

  async function handleSaveGroup(group: Group) {
    if (!canManagePermissions || !canEditGroupPermissions(group)) return;
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
    setPermissionGroup(null);
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
    if (!groupUser || !canManageAuth) return;
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

  if (!canManageAuth) {
    return <Result status="403" title="无权限访问认证授权" />;
  }

  if (activeSection === "groups" && !canManagePermissions) {
    return <Result status="403" title="无权限访问用户组权限" />;
  }

  return (
    <div className="admin-page-stack">
      {activeSection === "users" ? (
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
            <ProTable<User>
              className="admin-table"
              rowKey="id"
              headerTitle="用户列表"
              columns={userColumns}
              dataSource={users}
              cardBordered
              options={false}
              pagination={false}
              scroll={{ x: 840 }}
              search={false}
              toolBarRender={() =>
                canCreateUser
                  ? [
                      <Button
                        key="create"
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          createUserForm.setFieldsValue({ isActive: true });
                          setCreateUserOpen(true);
                        }}
                      >
                        新建用户
                      </Button>,
                    ]
                  : []
              }
            />
          </div>
        </Spin>
      ) : (
        <Spin spinning={loading}>
          <div className="admin-table-scroll-shell">
            <ProTable<Group>
              className="admin-table"
              rowKey="id"
              headerTitle="用户组列表"
              columns={groupColumns}
              dataSource={groups}
              cardBordered
              options={false}
              pagination={false}
              scroll={{ x: "100%" }}
              search={false}
              toolBarRender={() => [
                <Button
                  key="create"
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateGroupOpen(true)}
                >
                  新建用户组
                </Button>,
              ]}
            />
          </div>
        </Spin>
      )}

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
        title="用户日志"
        open={Boolean(logUser)}
        onClose={() => setLogUser(null)}
        size="large"
      >
        {logUser ? (
          <div className="admin-page-stack">
            <Typography.Text strong>
              {logUser.displayName || logUser.username}
            </Typography.Text>
            <ProTable<AdminOperationLog>
              className="admin-table"
              rowKey="id"
              headerTitle="日志列表"
              columns={userLogColumns}
              cardBordered
              options={false}
              search={false}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
              }}
              scroll={{ x: "100%" }}
              request={async (params) => {
                const result = await api.adminOperationLogs({
                  current: params.current,
                  pageSize: params.pageSize,
                  userId: logUser.id,
                });
                return {
                  data: result.items,
                  total: result.total,
                  success: true,
                };
              }}
            />
          </div>
        ) : null}
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

      <Drawer
        title="用户组权限"
        open={Boolean(permissionGroup)}
        onClose={closePermissionDrawer}
        size="large"
        extra={
          <Button
            type="primary"
            onClick={() => {
              if (permissionGroup) {
                void handleSaveGroup(permissionGroup);
              }
            }}
          >
            保存
          </Button>
        }
      >
        {permissionGroup ? (
          <div className="admin-page-stack">
            <Typography.Text strong>{permissionGroup.name}</Typography.Text>
            <Checkbox.Group
              className="admin-permission-list"
              value={
                groupDrafts[permissionGroup.id] ?? permissionGroup.permissions
              }
              onChange={(values) => {
                setGroupDrafts((current) => ({
                  ...current,
                  [permissionGroup.id]: values.map(String),
                }));
              }}
            >
              {availablePermissionGroups.map((permissionGroupItem) => (
                <div
                  className="admin-permission-group"
                  key={permissionGroupItem.group}
                >
                  <Typography.Text strong>
                    {permissionGroupItem.group}
                  </Typography.Text>
                  <div className="admin-permission-group-options">
                    {permissionGroupItem.items.map((permission) => (
                      <Checkbox key={permission.id} value={permission.id}>
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
          </div>
        ) : null}
        {availablePermissions.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : null}
      </Drawer>

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

function GroupTags({
  groupIds,
  groupNameById,
  maxVisible,
}: {
  groupIds: number[];
  groupNameById: Map<number, string>;
  maxVisible: number;
}) {
  if (groupIds.length === 0) {
    return <Tag>未分组</Tag>;
  }
  const visibleIds = groupIds.slice(0, maxVisible);
  const hiddenCount = groupIds.length - visibleIds.length;
  return (
    <Space size={[4, 4]} wrap>
      {visibleIds.map((groupId) => (
        <Tag key={groupId} color="green">
          {groupNameById.get(groupId) ?? `#${groupId}`}
        </Tag>
      ))}
      {hiddenCount > 0 ? <Tag color="default">+{hiddenCount}</Tag> : null}
    </Space>
  );
}

function PermissionTags({
  permissionIds,
  permissionLabelById,
  maxVisible,
}: {
  permissionIds: string[];
  permissionLabelById: Map<string, string>;
  maxVisible: number;
}) {
  const visibleIds = permissionIds.slice(0, maxVisible);
  const hiddenCount = permissionIds.length - visibleIds.length;
  return (
    <Space size={[4, 4]} wrap>
      {visibleIds.map((permissionId) => (
        <Tag key={permissionId} color="green">
          {permissionLabelById.get(permissionId) ?? permissionId}
        </Tag>
      ))}
      {hiddenCount > 0 ? <Tag color="default">+{hiddenCount}</Tag> : null}
    </Space>
  );
}

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

function canEditGroupPermissions(group: Group) {
  return !isSuperadminGroup(group);
}
