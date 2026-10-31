import SafeMarkdown from "../components/content/SafeMarkdown";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  ReadOutlined,
  TeamOutlined,
  PushpinOutlined,
} from "@ant-design/icons";
import { aboutAssets } from "../about/aboutSections";
import { useContentText } from "../components/content/contentText";
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  Layout,
  Modal,
  Pagination,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import WorkspaceHeader from "../components/WorkspaceHeader";
import {
  contentApi,
  type ContentArticle,
  type ContentArticleInput,
} from "../api/content";
import { useAppContext } from "../contexts/AppContext";
import "../styles/editorial.css";

const knowledgeCategories = [
  "物种与生态",
  "保护管理",
  "监测与数据",
  "研究方法",
];
const newsCategories = ["学术会议", "学术交流", "科研进展", "团队活动"];

export default function EditorialPage({
  kind,
}: {
  kind: "knowledge" | "news";
}) {
  const ui = useContentText();
  const { articleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { message } = App.useApp();
  const [items, setItems] = useState<ContentArticle[]>([]);
  const [article, setArticle] = useState<ContentArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [manage, setManage] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<ContentArticle | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [removedAssets, setRemovedAssets] = useState<number[]>([]);
  const [preview, setPreview] = useState(false);
  const [form] = Form.useForm();
  const categories =
    kind === "knowledge" ? knowledgeCategories : newsCategories;
  const base = kind === "knowledge" ? "/science-updates" : "/news";
  const isScience = kind === "knowledge";
  const title = ui(isScience ? "科普更新" : "团队动态");
  const publishLabel = ui(isScience ? "发布科普" : "发布团队动态");
  const sequence = useRef(0);
  const editSession = useRef(0);
  const pendingIds = useRef(new Set<number>());
  const [uploading, setUploading] = useState(0);
  const load = useCallback(async () => {
    const generation = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const result = await contentApi.articles({
        kind,
        q,
        category,
        offset: (page - 1) * 12,
        limit: 12,
        ...(manage ? { manage: "1" } : {}),
      });
      if (generation !== sequence.current) return;
      setItems(result.items);
      setTotal(result.total);
      setCanEdit(result.canEdit);
      if (articleId) {
        const detail = await contentApi.article(Number(articleId));
        if (generation !== sequence.current) return;
        if (detail.kind !== kind) throw new Error(ui("内容类型不匹配"));
        setArticle(detail);
      } else setArticle(null);
    } catch (e) {
      if (generation === sequence.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (generation === sequence.current) setLoading(false);
    }
  }, [kind, q, category, page, manage, articleId, ui]);
  useEffect(() => {
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);
  useEffect(
    () => () => {
      editSession.current += 1;
      for (const id of pendingIds.current)
        void contentApi.discardAsset(id).catch(() => {});
    },
    [],
  );
  async function cancelEdit() {
    editSession.current += 1;
    setEditing(null);
    const ids = [...pendingIds.current];
    pendingIds.current.clear();
    const results = await Promise.allSettled(
      ids.map((id) => contentApi.discardAsset(id)),
    );
    if (results.some((r) => r.status === "rejected"))
      message.warning(
        "暂存附件清理未完成，24 小时后不可访问，文件保留待检查 / Temporary uploads expire after 24 hours",
      );
  }
  function edit(item: ContentArticle | "new") {
    editSession.current += 1;
    pendingIds.current.clear();
    setEditing(item);
    setRemovedAssets([]);
    form.resetFields();
    form.setFieldsValue(
      item === "new"
        ? {
            title: "",
            summary: "",
            category: categories[0],
            body: "",
            status: "draft",
            source: "",
            linksText: "",
            pinned: false,
          }
        : {
            ...item,
            coverAssetId: item.assets.find((a) => a.url === item.coverUrl)?.id,
            linksText: item.links
              .map((l) => `${l.title} | ${l.url}`)
              .join("\n"),
          },
    );
  }
  async function save() {
    if (uploading) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const links = String(values.linksText || "")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf("|");
          if (index < 1)
            throw new Error(ui("学习链接请按“资料名称 | https://地址”填写"));
          return {
            title: line.slice(0, index).trim(),
            url: line.slice(index + 1).trim(),
          };
        });
      const body: ContentArticleInput = {
        removeAssetIds: removedAssets,
        commitAssetIds: [...pendingIds.current],
        assetCaptions:
          editing && editing !== "new"
            ? editing.assets.map((a) => ({ id: a.id, caption: a.caption }))
            : [],
        coverAssetId: values.coverAssetId ?? null,
        kind,
        title: values.title,
        category: values.category,
        body: values.body,
        summary: values.summary ?? "",
        source: values.source ?? "",
        status: values.status,
        pinned: Boolean(values.pinned),
        eventDate: values.eventDate ?? "",
        links,
        ...(editing && editing !== "new" ? { revision: editing.revision } : {}),
      };
      await contentApi.saveArticle(
        editing && editing !== "new" ? editing.id : null,
        body,
      );
      pendingIds.current.clear();
      editSession.current += 1;
      setEditing(null);
      await load();
      message.success(ui("内容已保存"));
    } catch (e) {
      message.error(e instanceof Error ? e.message : ui("请检查表单内容"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Layout className="editorial-page">
      <WorkspaceHeader
        activeTab={isScience ? "knowledge" : "about"}
        canBrowseData={Boolean(user?.permissions.canBrowseData)}
      />
      <main className="editorial-main">
        <nav className="editorial-breadcrumb" aria-label={ui("当前位置")}>
          <Link to={isScience ? "/knowledge" : "/about/system"}>
            {ui(isScience ? "胡杨科普" : "关于我们")}
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={base} aria-current={!articleId ? "page" : undefined}>
            {title}
          </Link>
          {articleId && (
            <>
              <span aria-hidden="true">/</span>
              <span>{ui("正文")}</span>
            </>
          )}
        </nav>
        <section
          className="editorial-hero"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5, 36, 29, .96), rgba(5, 36, 29, .75) 52%, rgba(5, 36, 29, .2)), url(${isScience ? aboutAssets.knowledgePopulusForestImage : aboutAssets.teamGreenhouseImage})`,
          }}
        >
          <div className="editorial-hero-content">
            <span className="editorial-eyebrow">
              {isScience
                ? "POPLAR SCIENCE · EXPLORE & LEARN"
                : "OUR TEAM · RESEARCH & CONNECTION"}
            </span>
            <h1>{title}</h1>
            <p>
              {ui(
                isScience
                  ? "从物种生态到保护实践，分享胡杨研究中的知识与发现。"
                  : "记录科研进展与交流现场，分享团队成长的每一步。",
              )}
            </p>
            <div className="editorial-hero-bottom">
              <span className="editorial-hero-note">
                {isScience ? <ReadOutlined /> : <TeamOutlined />}
                {ui(
                  isScience
                    ? "认识胡杨 · 理解生态 · 共同守护"
                    : "学术交流 · 科研协作 · 团队足迹",
                )}
              </span>
              {canEdit && (
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined aria-hidden="true" />}
                  onClick={() => edit("new")}
                >
                  {publishLabel}
                </Button>
              )}
            </div>
          </div>
        </section>
        <section
          className="editorial-content"
          aria-label={ui("内容列表与阅读")}
        >
          <div className="editorial-section-heading">
            <div>
              <span className="editorial-section-icon">
                {isScience ? <ReadOutlined /> : <TeamOutlined />}
              </span>
              <h2>{ui(isScience ? "科普文章" : "最新动态")}</h2>
            </div>
            {canEdit && (
              <label className="editorial-manage">
                <Switch
                  checked={manage}
                  aria-label={ui("管理内容")}
                  onChange={(value) => {
                    setManage(value);
                    setPage(1);
                  }}
                />
                <span>{ui("显示草稿与已下架内容")}</span>
              </label>
            )}
          </div>
          <div className="editorial-toolbar">
            <div
              className="editorial-categories"
              role="group"
              aria-label={ui("内容分类")}
            >
              <Button
                type={!category ? "primary" : "default"}
                aria-pressed={!category}
                onClick={() => {
                  setCategory("");
                  setPage(1);
                  navigate(base);
                }}
              >
                {ui("全部")}
              </Button>
              {categories.map((c) => (
                <Button
                  key={ui(c)}
                  type={category === c ? "primary" : "default"}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setPage(1);
                    navigate(base);
                  }}
                >
                  {ui(c)}
                </Button>
              ))}
            </div>
            <Input.Search
              className="editorial-search"
              aria-label={ui(isScience ? "搜索科普文章" : "搜索团队动态")}
              placeholder={ui(isScience ? "搜索科普文章" : "搜索团队动态")}
              allowClear
              onSearch={(value) => {
                setQ(value);
                setPage(1);
                navigate(base);
              }}
            />
          </div>
          {error ? (
            <Card>
              <Typography.Text type="danger">{error}</Typography.Text>
              <Button onClick={() => void load()}>{ui("重新加载")}</Button>
            </Card>
          ) : loading ? (
            <div className="editorial-loading">
              <Spin size="large" />
            </div>
          ) : article ? (
            <article className="editorial-detail">
              <div className="editorial-detail-actions">
                <Button
                  icon={<ArrowLeftOutlined aria-hidden="true" />}
                  onClick={() => navigate(base)}
                >
                  {ui("返回列表")}
                </Button>
                {canEdit && (
                  <Button onClick={() => edit(article)}>
                    {ui("编辑内容")}
                  </Button>
                )}
              </div>
              <Tag color="green">{ui(article.category)}</Tag>
              <h1>{article.title}</h1>
              <p className="editorial-meta">
                {kind === "news" && article.eventDate
                  ? `${ui("活动日期")} ${article.eventDate} / `
                  : ""}
                {ui(
                  { draft: "草稿", published: "已发布", archived: "已下架" }[
                    article.status
                  ],
                )}
                {article.publishedAt
                  ? ` ${article.publishedAt.slice(0, 10)}`
                  : ""}
              </p>
              {article.summary && (
                <p className="editorial-summary">{article.summary}</p>
              )}
              {article.coverUrl && (
                <Image
                  className="editorial-cover"
                  src={article.coverUrl}
                  alt={article.title}
                />
              )}
              {kind === "knowledge" &&
                article.assets.find((asset) => asset.url === article.coverUrl)
                  ?.caption && (
                  <p className="editorial-cover-caption">
                    {
                      article.assets.find(
                        (asset) => asset.url === article.coverUrl,
                      )?.caption
                    }
                  </p>
                )}
              <ArticleBody body={article.body} />
              {article.assets.some(
                (a) =>
                  a.mimeType.startsWith("image/") && a.url !== article.coverUrl,
              ) && (
                <section className="editorial-gallery">
                  <h2>{ui(kind === "news" ? "会议现场" : "图文资料")}</h2>
                  <Image.PreviewGroup>
                    {article.assets
                      .filter(
                        (a) =>
                          a.mimeType.startsWith("image/") &&
                          a.url !== article.coverUrl,
                      )
                      .map((a) => (
                        <figure key={a.id}>
                          <Image src={a.url} alt={a.caption || a.name} />
                          <figcaption>{a.caption}</figcaption>
                        </figure>
                      ))}
                  </Image.PreviewGroup>
                </section>
              )}
              {article.assets.some((a) => a.mimeType === "application/pdf") && (
                <section>
                  <h2>{ui("相关资料")}</h2>
                  {article.assets
                    .filter((a) => a.mimeType === "application/pdf")
                    .map((a) => (
                      <p key={a.id}>
                        <a href={a.url} target="_blank" rel="noreferrer">
                          {kind === "news" ? a.caption || a.name : a.name}
                          （PDF）
                        </a>
                      </p>
                    ))}
                </section>
              )}
              {article.links.length > 0 && (
                <section className="editorial-links">
                  <h2>{ui("继续学习")}</h2>
                  {article.links.map((l) => (
                    <a
                      key={`${l.title}:${l.url}`}
                      href={safeLink(l.url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.title}
                      <span>{ui("访问资料 ↗")}</span>
                    </a>
                  ))}
                </section>
              )}
            </article>
          ) : (
            <>
              <div className="editorial-grid">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className="editorial-card"
                    cover={
                      item.coverUrl ? (
                        <img
                          loading="lazy"
                          src={item.coverUrl}
                          alt={item.title}
                        />
                      ) : (
                        <div
                          className={`editorial-card-placeholder${isScience ? "" : " editorial-card-placeholder-news"}`}
                        >
                          {isScience ? <ReadOutlined /> : <TeamOutlined />}
                          <span>{ui(item.category)}</span>
                        </div>
                      )
                    }
                  >
                    <div className="editorial-card-tags">
                      <Tag color="green">{ui(item.category)}</Tag>
                      {item.pinned && (
                        <Tag icon={<PushpinOutlined />} color="gold">
                          {ui("置顶")}
                        </Tag>
                      )}
                      {manage && (
                        <Tag>
                          {ui(
                            {
                              draft: "草稿",
                              published: "已发布",
                              archived: "已下架",
                            }[item.status],
                          )}
                        </Tag>
                      )}
                    </div>
                    <Typography.Title level={3}>
                      <button onClick={() => navigate(`${base}/${item.id}`)}>
                        {item.title}
                      </button>
                    </Typography.Title>
                    <p>{item.summary}</p>
                    <div className="editorial-card-foot">
                      <span>
                        {item.eventDate || item.publishedAt.slice(0, 10)}
                      </span>
                      <Button
                        type="link"
                        onClick={() => navigate(`${base}/${item.id}`)}
                      >
                        {ui("阅读全文 →")}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
              {items.length === 0 && (
                <div className="editorial-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      q || category
                        ? ui("没有找到匹配内容")
                        : manage
                          ? ui("暂无内容，可新建条目")
                          : ui("暂无已发布内容")
                    }
                  />
                  <p>
                    {ui(
                      q || category
                        ? "请尝试其他关键词或分类。"
                        : "新的分享将在这里呈现，欢迎持续关注。",
                    )}
                  </p>
                </div>
              )}
              {total > 12 && (
                <Pagination
                  className="editorial-pagination"
                  current={page}
                  total={total}
                  pageSize={12}
                  showSizeChanger={false}
                  onChange={setPage}
                />
              )}
            </>
          )}
        </section>
      </main>
      <Modal
        className="editorial-editor-modal"
        forceRender
        open={Boolean(editing)}
        title={editing === "new" ? publishLabel : ui("编辑内容")}
        width="min(900px, calc(100vw - 32px))"
        styles={{
          body: { maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" },
        }}
        onCancel={() => {
          if (!saving) void cancelEdit();
        }}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        onOk={() => void save()}
        confirmLoading={saving || uploading > 0}
        okText={ui("保存")}
        cancelText={ui("取消")}
      >
        <Form form={form} layout="vertical">
          <p className="editorial-editor-hint">
            {ui("可先保存草稿；确认内容后，将发布状态设为“已发布”并保存。")}
          </p>
          <Form.Item hidden name="coverAssetId">
            <Input />
          </Form.Item>
          <Button
            className="editorial-preview-button"
            onClick={() => setPreview(true)}
          >
            {ui("预览正文")}
          </Button>
          <Form.Item
            name="title"
            label={ui("标题")}
            rules={[{ required: true }]}
          >
            <Input maxLength={180} />
          </Form.Item>
          <div className="editorial-form-grid">
            <Form.Item
              name="category"
              label={ui("分类")}
              rules={[{ required: true }]}
            >
              <Select
                options={categories.map((c) => ({ value: c, label: ui(c) }))}
              />
            </Form.Item>
            <Form.Item name="status" label={ui("发布状态")}>
              <Select
                options={[
                  { value: "draft", label: ui("草稿") },
                  { value: "published", label: ui("已发布") },
                  { value: "archived", label: ui("已下架") },
                ]}
              />
            </Form.Item>
            {kind === "news" && (
              <Form.Item name="eventDate" label={ui("活动日期")}>
                <Input type="date" />
              </Form.Item>
            )}
            <Form.Item name="pinned" valuePropName="checked" label={ui("置顶")}>
              <Switch />
            </Form.Item>
          </div>
          <Form.Item name="summary" label={ui("摘要")}>
            <Input.TextArea rows={2} maxLength={800} />
          </Form.Item>
          <Form.Item
            name="body"
            label={ui("正文（段落以空行分隔，## 表示小标题）")}
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={12} />
          </Form.Item>
          <Form.Item
            name="linksText"
            label={ui("学习链接，每行：资料名称 | https://地址")}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="source" label={ui("编辑备注（仅内部保存）")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {editing && editing !== "new" ? (
            <>
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  const session = editSession.current;
                  setUploading((n) => n + 1);
                  void contentApi
                    .uploadAsset(editing.id, file)
                    .then((asset) => {
                      if (session !== editSession.current) {
                        if (asset.pending)
                          void contentApi
                            .discardAsset(asset.id)
                            .catch(() => {});
                        return;
                      }
                      if (asset.pending) pendingIds.current.add(asset.id);
                      setEditing((current) => {
                        if (
                          !current ||
                          current === "new" ||
                          current.id !== editing.id
                        )
                          return current;
                        return current.assets.some((a) => a.id === asset.id)
                          ? current
                          : { ...current, assets: [...current.assets, asset] };
                      });
                      message.success(ui("附件已暂存，保存内容后生效"));
                    })
                    .catch((e) => message.error(e.message))
                    .finally(() => setUploading((n) => Math.max(0, n - 1)));
                  return false;
                }}
                accept="image/png,image/jpeg,image/webp,application/pdf"
              >
                <Button>{ui("上传图片或 PDF")}</Button>
              </Upload>
              <Space wrap style={{ marginTop: 12 }}>
                {editing.assets.map((a) => (
                  <Card size="small" key={a.id}>
                    <Space orientation="vertical">
                      <span>{a.name}</span>
                      <Input
                        aria-label={`${ui("图片或附件说明")}: ${a.name}`}
                        placeholder={ui("图片或附件说明")}
                        value={a.caption}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            assets: editing.assets.map((x) =>
                              x.id === a.id
                                ? { ...x, caption: e.target.value }
                                : x,
                            ),
                          })
                        }
                      />
                      <Space>
                        {a.mimeType.startsWith("image/") && (
                          <Button
                            size="small"
                            onClick={() => {
                              form.setFieldValue("coverAssetId", a.id);
                              message.success(ui("已选择封面，保存内容后生效"));
                            }}
                          >
                            {ui("设为封面")}
                          </Button>
                        )}
                        <Button
                          danger
                          size="small"
                          onClick={() => {
                            if (a.pending) {
                              pendingIds.current.delete(a.id);
                              void contentApi
                                .discardAsset(a.id)
                                .catch((e) => message.error(e.message));
                            } else setRemovedAssets((ids) => [...ids, a.id]);
                            setEditing({
                              ...editing,
                              assets: editing.assets.filter(
                                (x) => x.id !== a.id,
                              ),
                            });
                            if (form.getFieldValue("coverAssetId") === a.id)
                              form.setFieldValue("coverAssetId", null);
                          }}
                        >
                          {ui("移除附件")}
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                ))}
              </Space>
            </>
          ) : (
            <p>{ui("先保存草稿，再添加图片或 PDF 附件。")}</p>
          )}
        </Form>
      </Modal>
      <Modal
        className="editorial-editor-modal"
        open={preview}
        title={(editing ? form.getFieldValue("title") : "") || ui("内容预览")}
        footer={null}
        width="min(850px, calc(100vw - 32px))"
        onCancel={() => setPreview(false)}
      >
        <ArticleBody body={(editing ? form.getFieldValue("body") : "") ?? ""} />
      </Modal>
    </Layout>
  );
}

function safeLink(url: string) {
  return /^https?:\/\//i.test(url) ? url : undefined;
}
function ArticleBody({ body }: { body: string }) {
  return (
    <div className="editorial-body">
      <SafeMarkdown text={body} math />
    </div>
  );
}
