import { ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Select,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type {
  MapComposition,
  WorkspaceAccessGroup,
  WorkspaceScene,
} from "../../types";
import { downloadBlob } from "../../utils/download";
import MapCompositionCard from "./MapCompositionCard";

interface Props {
  items: MapComposition[];
  availableAudienceGroups: WorkspaceAccessGroup[];
  availableProjectAccessGroups: WorkspaceAccessGroup[];
  loading: boolean;
  onRefresh: () => unknown | Promise<unknown>;
  onOpen: (composition: MapComposition) => void | Promise<void>;
  onLoadSource: (composition: MapComposition) => void | Promise<void>;
  onRestored: (project: WorkspaceScene) => void | Promise<void>;
  onChanged: (composition: MapComposition) => void;
  onDeleted: (compositionId: number) => void;
}

interface PublishValues {
  versionNumber: number;
  audienceGroupIds: number[];
}

interface RestoreValues {
  versionNumber: number;
  name: string;
  description?: string;
  accessGroupIds?: number[];
  unavailableResourcePolicy: "skip" | "fail";
}

export default function MapCompositionPanel({
  items,
  availableAudienceGroups,
  availableProjectAccessGroups,
  loading,
  onRefresh,
  onOpen,
  onLoadSource,
  onRestored,
  onChanged,
  onDeleted,
}: Props) {
  const { message, notification } = App.useApp();
  const [publishForm] = Form.useForm<PublishValues>();
  const [restoreForm] = Form.useForm<RestoreValues>();
  const [status, setStatus] = useState<"all" | MapComposition["status"]>("all");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [publishingComposition, setPublishingComposition] =
    useState<MapComposition | null>(null);
  const [restoringComposition, setRestoringComposition] =
    useState<MapComposition | null>(null);
  const visibleItems = useMemo(
    () => items.filter((item) => status === "all" || item.status === status),
    [items, status],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  async function preview(composition: MapComposition) {
    const version = composition.currentVersion;
    if (!composition.canPreview || !version) return;
    try {
      const result = await api.downloadMapCompositionVersion(
        composition.id,
        version.versionNumber,
        "preview",
      );
      const nextUrl = URL.createObjectURL(result.blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setPreviewTitle(`${composition.name} · V${version.versionNumber}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题图预览失败");
    }
  }

  async function download(composition: MapComposition) {
    const version = composition.currentVersion;
    if (!composition.canDownload || !version) return;
    try {
      const result = await api.downloadMapCompositionVersion(
        composition.id,
        version.versionNumber,
      );
      downloadBlob(result.blob, result.filename);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "专题成果下载失败",
      );
    }
  }

  function openPublish(composition: MapComposition) {
    const defaultVersion =
      composition.publishedVersion?.versionNumber ??
      composition.currentVersion?.versionNumber;
    if (!defaultVersion) {
      message.warning("请先生成至少一个专题成果版本");
      return;
    }
    setPublishingComposition(composition);
    publishForm.setFieldsValue({
      versionNumber: defaultVersion,
      audienceGroupIds: composition.audienceGroups.map((group) => group.id),
    });
  }

  async function submitPublish() {
    if (!publishingComposition) return;
    const values = await publishForm.validateFields();
    setPublishing(true);
    try {
      const result = await api.publishMapComposition(
        publishingComposition.id,
        values,
      );
      onChanged(result);
      setPublishingComposition(null);
      message.success(
        publishingComposition.status === "published"
          ? "专题发布版本和范围已更新"
          : "专题已发布",
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题发布失败");
    } finally {
      setPublishing(false);
    }
  }

  async function unpublish(composition: MapComposition) {
    try {
      const result = await api.unpublishMapComposition(composition.id);
      onChanged(result);
      message.success("专题已下架，仅所属用户和管理员可见");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题下架失败");
    }
  }

  function openRestore(composition: MapComposition) {
    const version = composition.publishedVersion ?? composition.currentVersion;
    if (!version) return;
    setRestoringComposition(composition);
    restoreForm.setFieldsValue({
      versionNumber: version.versionNumber,
      name: `${composition.name} V${version.versionNumber} 恢复工程`,
      description: `由专题“${composition.name}”成果 V${version.versionNumber} 恢复`,
      accessGroupIds: [],
      unavailableResourcePolicy: "skip",
    });
  }

  async function submitRestore() {
    if (!restoringComposition) return;
    const values = await restoreForm.validateFields();
    setRestoring(true);
    try {
      const result = await api.restoreMapCompositionProject(
        restoringComposition.id,
        values,
      );
      setRestoringComposition(null);
      if (result.warnings.length > 0) {
        notification.warning({
          message: "工程已恢复，部分图层未加载",
          description: result.warnings
            .map((warning) => warning.message)
            .join("；"),
          duration: 8,
        });
      } else {
        message.success("专题版本已还原为新工程");
      }
      await onRestored(result.project);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "专题还原失败");
    } finally {
      setRestoring(false);
    }
  }

  async function deleteComposition(composition: MapComposition) {
    try {
      await api.deleteMapComposition(composition.id);
      onDeleted(composition.id);
      message.success("出图稿已删除");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "出图稿删除失败");
    }
  }

  return (
    <section className="panel-section map-composition-panel">
      <div className="map-composition-panel-toolbar">
        <Segmented
          size="small"
          value={status}
          options={[
            { label: "全部", value: "all" },
            { label: "草稿", value: "draft" },
            { label: "未发布", value: "completed" },
            { label: "已发布", value: "published" },
          ]}
          onChange={(value) =>
            setStatus(value as "all" | MapComposition["status"])
          }
        />
        <Button
          size="small"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void onRefresh()}
        />
      </div>
      {visibleItems.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无可见专题出图成果"
        />
      ) : (
        <div className="map-composition-list">
          {visibleItems.map((composition) => (
            <MapCompositionCard
              key={composition.id}
              composition={composition}
              onPreview={() => void preview(composition)}
              onOpen={() => void onOpen(composition)}
              onDownload={() => void download(composition)}
              onPublish={() => openPublish(composition)}
              onUnpublish={() => void unpublish(composition)}
              onRestore={() => openRestore(composition)}
              onLoadSource={() => void onLoadSource(composition)}
              onDelete={() => void deleteComposition(composition)}
            />
          ))}
        </div>
      )}
      <Modal
        title={previewTitle}
        open={Boolean(previewUrl)}
        footer={null}
        width="min(1000px, 92vw)"
        onCancel={() => setPreviewUrl("")}
      >
        {previewUrl ? (
          <img
            className="map-composition-preview-image"
            src={previewUrl}
            alt={previewTitle}
          />
        ) : null}
      </Modal>
      <Modal
        title={
          publishingComposition?.status === "published"
            ? "更新专题发布"
            : "发布专题"
        }
        open={Boolean(publishingComposition)}
        okText="确认发布"
        confirmLoading={publishing}
        onOk={() => void submitPublish()}
        onCancel={() => setPublishingComposition(null)}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          title="发布前仅所属用户、平台管理员和超级管理员可见"
          description="发布后，只有所选角色中具备专题查看权限的用户可以访问；下载和还原能力继续由角色功能权限控制。"
          style={{ marginBottom: 16 }}
        />
        <Form form={publishForm} layout="vertical">
          <Form.Item
            name="versionNumber"
            label="正式发布版本"
            rules={[{ required: true, message: "请选择发布版本" }]}
          >
            <Select
              options={(publishingComposition?.versions ?? []).map(
                (version) => ({
                  value: version.versionNumber,
                  label: `V${version.versionNumber} · ${version.format.toUpperCase()} · ${new Date(version.createdAt).toLocaleString("zh-CN")}`,
                }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="audienceGroupIds"
            label="发布可见角色"
            rules={[{ required: true, message: "请至少选择一个可见角色" }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择专题发布后可见的角色"
              options={availableAudienceGroups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="还原专题版本为新工程"
        open={Boolean(restoringComposition)}
        okText="创建并加载工程"
        confirmLoading={restoring}
        onOk={() => void submitRestore()}
        onCancel={() => setRestoringComposition(null)}
        destroyOnHidden
      >
        <Form form={restoreForm} layout="vertical">
          <Form.Item
            name="versionNumber"
            label="恢复版本"
            rules={[{ required: true, message: "请选择恢复版本" }]}
          >
            <Select
              options={(restoringComposition?.versions ?? []).map(
                (version) => ({
                  value: version.versionNumber,
                  label: `V${version.versionNumber} · ${version.format.toUpperCase()}`,
                }),
              )}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="新工程名称"
            rules={[{ required: true, message: "请输入新工程名称" }]}
          >
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item name="description" label="工程说明">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="accessGroupIds" label="工程额外可见角色">
            <Select
              mode="multiple"
              allowClear
              options={availableProjectAccessGroups.map((group) => ({
                value: group.id,
                label: group.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="unavailableResourcePolicy"
            label="不可用资源处理"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "skip", label: "跳过并提示（推荐）" },
                { value: "fail", label: "存在不可用资源时停止恢复" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
