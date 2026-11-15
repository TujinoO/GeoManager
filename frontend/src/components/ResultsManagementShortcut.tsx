import {
  AuditOutlined,
  ArrowRightOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Badge, Button, Typography } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAppContext } from "../contexts/AppContext";
import type { ResultReviewSummary } from "../types";
import {
  isWorkspaceInventoryChange,
  workspaceInventoryChangedEvent,
} from "../workspace/workspaceSync";

export default function ResultsManagementShortcut() {
  const { user } = useAppContext();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canReview = Boolean(
    user?.username !== "guest" &&
    ((user?.permissions.canViewMapCompositions &&
      user.permissions.canPublishMapCompositions) ||
      (user?.permissions.canViewResultArtifacts &&
        user.permissions.canPublishResultArtifacts)),
  );
  const [summary, setSummary] = useState<ResultReviewSummary>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setSummary(undefined);
    setFailed(false);
    if (!canReview) return;
    let active = true;
    let sequence = 0;
    async function refresh() {
      const request = ++sequence;
      try {
        const next = await api.resultReviewSummary();
        if (active && request === sequence) {
          setSummary(next);
          setFailed(false);
        }
      } catch {
        if (active && request === sequence) setFailed(true);
      }
    }
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    function refreshFromEvent(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (isWorkspaceInventoryChange(detail) && detail.kind !== "workspace")
        void refresh();
    }
    function refreshFromStorage(event: StorageEvent) {
      if (event.key !== workspaceInventoryChangedEvent || !event.newValue)
        return;
      try {
        const detail: unknown = JSON.parse(event.newValue);
        if (isWorkspaceInventoryChange(detail) && detail.kind !== "workspace")
          refreshWhenVisible();
      } catch {
        /* Ignore unrelated or malformed storage notifications. */
      }
    }
    void refresh();
    const interval = window.setInterval(refreshWhenVisible, 60_000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener(workspaceInventoryChangedEvent, refreshFromEvent);
    window.addEventListener("storage", refreshFromStorage);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener(
        workspaceInventoryChangedEvent,
        refreshFromEvent,
      );
      window.removeEventListener("storage", refreshFromStorage);
    };
  }, [
    canReview,
    user?.id,
    user?.permissions.canViewMapCompositions,
    user?.permissions.canViewResultArtifacts,
    user?.permissions.canPublishMapCompositions,
    user?.permissions.canPublishResultArtifacts,
    retry,
  ]);

  if (!canReview) return null;
  const count = failed
    ? "!"
    : (summary?.pendingCount ?? (
        <LoadingOutlined aria-label={t("results.reviewLoading")} />
      ));
  const href =
    !failed && summary && summary.pendingCount > 0
      ? "/resources/manage/topics?status=pending"
      : "/resources/manage/topics";
  return (
    <section
      className="results-management-shortcut"
      aria-label={t("results.reviewEntry")}
    >
      <div>
        <Typography.Text className="results-review-kicker">
          {t("results.reviewKicker")}
        </Typography.Text>
        <Typography.Paragraph
          className="results-review-hint"
          aria-live="polite"
        >
          {failed
            ? t("results.reviewUnavailable")
            : summary
              ? summary.pendingCount > 0
                ? t("results.reviewBreakdown", {
                    maps: summary.pendingMapCount,
                    artifacts: summary.pendingArtifactCount,
                  })
                : t("results.reviewEmpty")
              : t("results.reviewLoading")}
        </Typography.Paragraph>
        {failed && (
          <Button
            type="link"
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => setRetry((value) => value + 1)}
          >
            {t("results.reviewRetry")}
          </Button>
        )}
      </div>
      <Badge
        className={`results-review-badge${!failed && summary?.pendingCount === 0 ? " results-review-badge-clear" : ""}`}
        count={count}
        showZero
        overflowCount={999}
        title={
          failed
            ? t("results.reviewUnavailable")
            : summary
              ? t("results.reviewPending", { count: summary.pendingCount })
              : t("results.reviewLoading")
        }
      >
        <Button
          type="primary"
          size="large"
          className="results-review-button"
          icon={<AuditOutlined />}
          onClick={() => navigate(href)}
        >
          <span>{t("results.reviewEntry")}</span>
          <ArrowRightOutlined />
        </Button>
      </Badge>
    </section>
  );
}
