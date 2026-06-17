import {
  ApartmentOutlined,
  AppstoreOutlined,
  BookOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  FundProjectionScreenOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Empty,
  Input,
  Popover,
  QRCode,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import capfedLogo from "../assets/capfed-logo.png";
import { useAppContext } from "../contexts/AppContext";
import type { Achievement, ResourceListItem, WorkspaceScene } from "../types";
import {
  resourceCategory,
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
} from "../utils/resources";

export type WorkspaceTab = "map" | "nongeo" | "admin";

const platformChineseName = "中亚胡杨林生态系统保护数据共享平台";
const hoverExpandDelayMs = 100;
const searchOpenDelayMs = 400;

interface WorkspaceHeaderProps {
  activeTab: WorkspaceTab;
  canBrowseData: boolean;
  dataPanel?: ReactNode;
  dataPanelOpen?: boolean;
  resources?: ResourceListItem[];
  workspaceScenes?: WorkspaceScene[];
  achievements?: Achievement[];
  searchKeyword?: string;
  onDataPanelOpenChange?: (open: boolean) => void;
  onGlobalSearch?: (keyword: string) => void;
  onQuickLoadResource?: (resource: ResourceListItem) => void;
  onLoadWorkspaceScene?: (scene: WorkspaceScene) => void;
  onOpenAchievement?: (achievement: Achievement) => void;
  onSearchFocus?: () => void;
}

export default function WorkspaceHeader({
  activeTab,
  canBrowseData,
  dataPanel,
  dataPanelOpen,
  resources,
  workspaceScenes,
  achievements,
  searchKeyword = "",
  onDataPanelOpenChange,
  onGlobalSearch,
  onQuickLoadResource,
  onLoadWorkspaceScene,
  onOpenAchievement,
  onSearchFocus,
}: WorkspaceHeaderProps) {
  const { bootstrap, user, setUser } = useAppContext();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [localResources, setLocalResources] = useState<ResourceListItem[]>([]);
  const [localWorkspaceScenes, setLocalWorkspaceScenes] = useState<
    WorkspaceScene[]
  >([]);
  const [localAchievements, setLocalAchievements] = useState<Achievement[]>([]);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchCompact, setSearchCompact] = useState(false);
  const [navCompressed, setNavCompressed] = useState(false);
  const [navMeasured, setNavMeasured] = useState(false);
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null);
  const [searchPopoverWidth, setSearchPopoverWidth] = useState<
    number | undefined
  >();
  const searchNavRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLElement | null>(null);
  const primaryNavRef = useRef<HTMLElement | null>(null);
  const searchOpenTimerRef = useRef<number | null>(null);
  const tabHoverTimerRef = useRef<number | null>(null);
  const navMeasureTimerRef = useRef<number | null>(null);
  const fullPrimaryNavWidthRef = useRef(0);
  const effectiveResources = resources ?? localResources;
  const effectiveWorkspaceScenes = workspaceScenes ?? localWorkspaceScenes;
  const effectiveAchievements = achievements ?? localAchievements;

  useEffect(() => {
    setSearchText(searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    if (
      !canBrowseData ||
      (resources !== undefined &&
        workspaceScenes !== undefined &&
        achievements !== undefined)
    ) {
      return;
    }
    let mounted = true;
    async function loadGlobalSearchItems() {
      try {
        const [resourceResponse, sceneResponse, achievementResponse] =
          await Promise.all([
            resources === undefined ? api.resources({}) : null,
            workspaceScenes === undefined ? api.workspaces() : null,
            achievements === undefined ? api.achievements() : null,
          ]);
        if (!mounted) {
          return;
        }
        if (resourceResponse) {
          setLocalResources(resourceResponse.items);
        }
        if (sceneResponse) {
          setLocalWorkspaceScenes(sceneResponse.items);
        }
        if (achievementResponse) {
          setLocalAchievements(achievementResponse.items);
        }
      } catch (error) {
        message.warning(
          error instanceof Error ? error.message : "全局搜索内容加载失败",
        );
      }
    }
    void loadGlobalSearchItems();
    return () => {
      mounted = false;
    };
  }, [achievements, canBrowseData, message, resources, workspaceScenes]);

  useEffect(() => {
    navMeasureTimerRef.current = window.setTimeout(() => {
      setNavMeasured(true);
      navMeasureTimerRef.current = null;
    }, 120);
    return () => {
      if (navMeasureTimerRef.current !== null) {
        window.clearTimeout(navMeasureTimerRef.current);
        navMeasureTimerRef.current = null;
      }
    };
  }, []);

  const syncSearchPopoverWidth = useCallback(() => {
    const width = searchContainerRef.current?.getBoundingClientRect().width;
    if (width && Number.isFinite(width)) {
      setSearchPopoverWidth(Math.round(width));
    }
  }, []);

  const measureNavFit = useCallback(() => {
    const nav = searchNavRef.current;
    const search = searchContainerRef.current;
    const primaryNav = primaryNavRef.current;
    if (!nav || !search || !primaryNav) return;

    const primaryNavWidth = primaryNav.scrollWidth;
    if (!navCompressed || !searchExpanded) {
      fullPrimaryNavWidthRef.current = Math.max(
        fullPrimaryNavWidthRef.current,
        primaryNavWidth,
      );
    }

    const navStyle = window.getComputedStyle(nav);
    const navGap =
      Number.parseFloat(navStyle.columnGap || navStyle.gap || "0") || 0;
    const rootFontSize =
      Number.parseFloat(
        window.getComputedStyle(document.documentElement).fontSize,
      ) || 16;
    const navWidth = nav.clientWidth;
    const searchMinWidth = clampNumber(
      3.75 * rootFontSize,
      0.08 * navWidth,
      5 * rootFontSize,
    );
    const searchCollapsedWidth = clampNumber(
      searchMinWidth,
      0.22 * navWidth,
      11 * rootFontSize,
    );
    const searchMaxWidth = clampNumber(
      searchCollapsedWidth * 2,
      0.44 * navWidth,
      22 * rootFontSize,
    );
    const fullTabsWidth = fullPrimaryNavWidthRef.current;
    const expandedFits =
      fullTabsWidth + searchMaxWidth + navGap <= navWidth + 1;
    const compactFits = fullTabsWidth + searchMinWidth + navGap <= navWidth + 1;
    const shouldCompactSearch = !searchExpanded && !expandedFits;
    const shouldCompressTabs = searchExpanded ? !expandedFits : !compactFits;

    setSearchCompact((current) =>
      current === shouldCompactSearch ? current : shouldCompactSearch,
    );
    setNavCompressed((current) =>
      current === shouldCompressTabs ? current : shouldCompressTabs,
    );
  }, [navCompressed, searchExpanded]);

  const expandSearch = useCallback(() => {
    setSearchExpanded(true);
    window.requestAnimationFrame(() => {
      syncSearchPopoverWidth();
      measureNavFit();
    });
  }, [measureNavFit, syncSearchPopoverWidth]);

  const scheduleSearchOpen = useCallback(
    (delay = 0) => {
      if (searchOpenTimerRef.current !== null) {
        window.clearTimeout(searchOpenTimerRef.current);
      }
      searchOpenTimerRef.current = window.setTimeout(() => {
        syncSearchPopoverWidth();
        setSearchOpen(true);
        searchOpenTimerRef.current = null;
      }, delay);
    },
    [syncSearchPopoverWidth],
  );

  const openSearchPanel = useCallback(
    (delay = 0) => {
      expandSearch();
      onSearchFocus?.();
      scheduleSearchOpen(delay);
    },
    [expandSearch, onSearchFocus, scheduleSearchOpen],
  );

  const closeSearchPanel = useCallback(() => {
    if (searchOpenTimerRef.current !== null) {
      window.clearTimeout(searchOpenTimerRef.current);
      searchOpenTimerRef.current = null;
    }
    setSearchOpen(false);
    setSearchExpanded(false);
    setExpandedTabId(null);
    window.requestAnimationFrame(measureNavFit);
  }, [measureNavFit]);

  const clearTabHoverTimer = useCallback(() => {
    if (tabHoverTimerRef.current !== null) {
      window.clearTimeout(tabHoverTimerRef.current);
      tabHoverTimerRef.current = null;
    }
  }, []);

  const scheduleTabHoverExpand = useCallback(
    (tabId: string) => {
      clearTabHoverTimer();
      tabHoverTimerRef.current = window.setTimeout(() => {
        setExpandedTabId(tabId);
        tabHoverTimerRef.current = null;
      }, hoverExpandDelayMs);
    },
    [clearTabHoverTimer],
  );

  const collapseTabHover = useCallback(() => {
    clearTabHoverTimer();
    setExpandedTabId(null);
  }, [clearTabHoverTimer]);

  useLayoutEffect(() => {
    const container = searchContainerRef.current;
    if (!container) return;
    syncSearchPopoverWidth();
    const observer = new ResizeObserver(syncSearchPopoverWidth);
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncSearchPopoverWidth]);

  useLayoutEffect(() => {
    const nav = searchNavRef.current;
    const search = searchContainerRef.current;
    const primaryNav = primaryNavRef.current;
    if (!nav || !search || !primaryNav) return;

    measureNavFit();
    const observer = new ResizeObserver(measureNavFit);
    observer.observe(nav);
    observer.observe(search);
    observer.observe(primaryNav);
    return () => observer.disconnect();
  }, [measureNavFit]);

  useLayoutEffect(() => {
    window.requestAnimationFrame(measureNavFit);
  }, [measureNavFit]);

  useEffect(() => {
    return () => {
      if (searchOpenTimerRef.current !== null) {
        window.clearTimeout(searchOpenTimerRef.current);
      }
      if (tabHoverTimerRef.current !== null) {
        window.clearTimeout(tabHoverTimerRef.current);
      }
      if (navMeasureTimerRef.current !== null) {
        window.clearTimeout(navMeasureTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const targetNode = event.target instanceof Node ? event.target : null;
      const targetElement =
        event.target instanceof Element ? event.target : null;
      if (
        (targetNode && searchContainerRef.current?.contains(targetNode)) ||
        targetElement?.closest(".workspace-search-popover")
      ) {
        return;
      }
      closeSearchPanel();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeSearchPanel]);

  const searchQuery = searchText.trim().toLocaleLowerCase("zh-CN");
  const filteredResources = useMemo(
    () =>
      effectiveResources.filter((resource) =>
        searchQuery ? resourceMatches(resource, searchQuery) : true,
      ),
    [effectiveResources, searchQuery],
  );
  const filteredWorkspaceScenes = useMemo(
    () =>
      effectiveWorkspaceScenes.filter((scene) =>
        searchQuery ? sceneMatches(scene, searchQuery) : true,
      ),
    [effectiveWorkspaceScenes, searchQuery],
  );
  const filteredAchievements = useMemo(
    () =>
      effectiveAchievements.filter((achievement) =>
        searchQuery ? achievementMatches(achievement, searchQuery) : true,
      ),
    [effectiveAchievements, searchQuery],
  );
  const searchCategories = useMemo(
    () =>
      buildSearchCategories(
        effectiveResources,
        effectiveWorkspaceScenes,
        effectiveAchievements,
      ),
    [effectiveAchievements, effectiveResources, effectiveWorkspaceScenes],
  );

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : "退出接口异常，本地会话已清空",
      );
    } finally {
      setUser(null);
    }
  }

  function handleSearchTextChange(value: string) {
    setSearchText(value);
    if (searchOpen) {
      openSearchPanel(0);
    } else {
      expandSearch();
    }
    onGlobalSearch?.(value.trim());
  }

  function handleSearchClick() {
    const currentWidth =
      searchContainerRef.current?.getBoundingClientRect().width;
    const visuallyExpanded = currentWidth ? currentWidth > 220 : false;
    openSearchPanel(searchExpanded || visuallyExpanded ? 0 : searchOpenDelayMs);
  }

  function commitSearch(value: string) {
    const keyword = value.trim();
    const query = keyword ? `?resourceQ=${encodeURIComponent(keyword)}` : "";
    navigate(`/map${query}`);
    onDataPanelOpenChange?.(Boolean(dataPanel));
    onGlobalSearch?.(keyword);
    closeSearchPanel();
  }

  function openResourceSearch(resource: ResourceListItem) {
    navigate(`/map?resourceQ=${encodeURIComponent(resource.name)}`);
    onDataPanelOpenChange?.(Boolean(dataPanel));
    onGlobalSearch?.(resource.name);
    closeSearchPanel();
  }

  function quickLoadResource(resource: ResourceListItem) {
    if (onQuickLoadResource) {
      onQuickLoadResource(resource);
      closeSearchPanel();
      return;
    }
    openResourceSearch(resource);
  }

  function openWorkspaceScene(scene: WorkspaceScene) {
    if (onLoadWorkspaceScene) {
      onLoadWorkspaceScene(scene);
    } else {
      navigate(`/map?sceneId=${scene.id}`);
    }
    setSearchOpen(false);
    closeSearchPanel();
  }

  function openAchievement(achievement: Achievement) {
    if (onOpenAchievement) {
      onOpenAchievement(achievement);
    } else {
      message.info(`成果详情正在接入：${achievement.title}`);
    }
    closeSearchPanel();
  }

  const dismissSearchForNavigation = useCallback(() => {
    closeSearchPanel();
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      searchContainerRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
  }, [closeSearchPanel]);

  const navigateFromHeader = useCallback(
    (path: string) => {
      dismissSearchForNavigation();
      navigate(path);
    },
    [dismissSearchForNavigation, navigate],
  );

  function handleResourceCenter() {
    if (!canBrowseData) {
      message.warning("当前账号暂无数据资源浏览权限");
      return;
    }
    navigateFromHeader("/map");
    onDataPanelOpenChange?.(Boolean(dataPanel));
  }

  const dataButton = (
    <Button
      type="text"
      className={tabClass(false, expandedTabId === "resource")}
      onClick={dataPanel ? undefined : handleResourceCenter}
      onMouseEnter={() => scheduleTabHoverExpand("resource")}
      onMouseLeave={collapseTabHover}
      title="资源中心"
    >
      <FolderOpenOutlined aria-hidden="true" style={{ fontSize: 16 }} />
      <span className="tab-text">资源中心</span>
    </Button>
  );

  const wechatContent = (
    <div className="wechat-popover-content">
      <QRCode
        value="https://example.local/capfed-wechat"
        size={136}
        bordered={false}
        color="#173f39"
      />
      <strong>中亚胡杨林数据平台</strong>
      <span>微信公众号二维码示意</span>
    </div>
  );

  const aboutContent = (
    <div className="about-popover-content">
      <strong>{bootstrap.systemName}</strong>
      <span>
        面向胡杨林生态系统保护的数据共享、目录检索与三维地理可视化平台。
      </span>
    </div>
  );

  const userContent = (
    <div className="user-popover-content">
      <div className="user-popover-head">
        <Avatar
          size={42}
          src={user?.avatarUrl || undefined}
          icon={<UserOutlined />}
        />
        <span>
          <strong>{user?.displayName || user?.username || "当前用户"}</strong>
          <small>{user?.username}</small>
        </span>
      </div>
      <div className="user-popover-meta">
        {user?.department && <span>部门：{user.department}</span>}
        {user?.email && <span>邮箱：{user.email}</span>}
      </div>
      <div className="user-popover-actions">
        <Button size="small" onClick={() => navigate("/admin/profile")}>
          个人信息
        </Button>
        <Button size="small" icon={<LogoutOutlined />} onClick={handleLogout}>
          安全退出
        </Button>
      </div>
    </div>
  );

  const searchContent = (
    <section className="workspace-search-results" aria-label="全局搜索结果">
      <SearchResultSection
        title="数据"
        icon={<DatabaseOutlined style={{ fontSize: 15 }} />}
        emptyText="暂无匹配数据"
      >
        {filteredResources.map((resource) => (
          <div className="workspace-search-row" key={`resource-${resource.id}`}>
            <Button
              type="text"
              className="workspace-search-row-main workspace-search-row-trigger"
              onClick={() => openResourceSearch(resource)}
            >
              <strong>{resource.name}</strong>
              <small>
                {resourceCategoryName(resource) ?? "未分类"} ·{" "}
                {resourceFormatLabel(resource)}
              </small>
            </Button>
            <Button
              size="small"
              type="primary"
              ghost
              disabled={!resource.isQueryable && !resource.isRenderable}
              onClick={() => quickLoadResource(resource)}
            >
              快速加载
            </Button>
          </div>
        ))}
      </SearchResultSection>

      <SearchResultSection
        title="工程"
        icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
        emptyText="暂无匹配工程或专题"
      >
        {filteredWorkspaceScenes.map((scene) => (
          <Button
            type="text"
            className="workspace-search-row"
            key={`scene-${scene.id}`}
            onClick={() => openWorkspaceScene(scene)}
          >
            <span className="workspace-search-row-main">
              <strong>{scene.name}</strong>
              <small>{scene.description || formatSceneUpdatedAt(scene)}</small>
            </span>
            <Tag color={scene.kind === "project" ? "blue" : "green"}>
              {scene.kind === "project" ? "工程" : "专题"}
            </Tag>
          </Button>
        ))}
      </SearchResultSection>

      <SearchResultSection
        title="成果"
        icon={<FundProjectionScreenOutlined style={{ fontSize: 15 }} />}
        emptyText="暂无匹配成果"
      >
        {filteredAchievements.map((achievement) => (
          <Button
            type="text"
            className="workspace-search-row"
            key={`achievement-${achievement.id}`}
            onClick={() => openAchievement(achievement)}
          >
            <span className="workspace-search-row-main">
              <strong>{achievement.title}</strong>
              <small>
                {achievement.category?.name ?? "未分类"} ·{" "}
                {achievement.source || achievement.code}
              </small>
            </span>
            <Tag color="purple">成果</Tag>
          </Button>
        ))}
      </SearchResultSection>

      <div className="workspace-search-categories">
        <Typography.Text type="secondary">分类</Typography.Text>
        <div>
          {searchCategories.map((category) => (
            <Tag
              key={`${category.kind}-${category.label}`}
              className="workspace-search-category"
              onClick={() => handleSearchTextChange(category.label)}
            >
              {category.label}
            </Tag>
          ))}
        </div>
      </div>
    </section>
  );

  return (
    <header
      className={`workspace-header${navMeasured ? " workspace-header-nav-measured" : " workspace-header-nav-measuring"}${searchExpanded ? " workspace-header-search-active" : ""}${searchCompact ? " workspace-header-search-compact" : ""}${navCompressed ? " workspace-header-nav-compressed" : ""}`}
    >
      <div className="brand-block">
        <span className="brand-logo-frame">
          <img src={capfedLogo} alt={`${bootstrap.systemName} Logo`} />
        </span>
        <div className="brand-copy">
          <strong>CAPFED</strong>
          <Typography.Title level={4}>{platformChineseName}</Typography.Title>
        </div>
      </div>

      <div
        ref={searchNavRef}
        className={`workspace-search-nav${navCompressed ? " workspace-search-nav-compressed" : ""}`}
      >
        <Popover
          trigger="click"
          placement="bottomLeft"
          open={searchOpen}
          styles={{
            content: {
              width: searchPopoverWidth,
            },
          }}
          classNames={{ root: "workspace-search-popover" }}
          content={searchContent}
        >
          <search ref={searchContainerRef} className="workspace-global-search">
            <Input
              className="workspace-global-input"
              allowClear
              prefix={<SearchOutlined style={{ fontSize: 15 }} />}
              value={searchText}
              placeholder="搜索数据、工程、成果"
              onFocus={expandSearch}
              onClick={handleSearchClick}
              onChange={(event) => handleSearchTextChange(event.target.value)}
              onPressEnter={(event) => commitSearch(event.currentTarget.value)}
            />
          </search>
        </Popover>

        <nav
          ref={primaryNavRef}
          className="header-primary-actions"
          aria-label="主导航"
        >
          <Button
            type="text"
            className={tabClass(activeTab === "map", expandedTabId === "map")}
            onClick={() => navigateFromHeader("/map")}
            onMouseEnter={() => scheduleTabHoverExpand("map")}
            onMouseLeave={collapseTabHover}
            title="地理数据"
          >
            <ApartmentOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span className="tab-text">地理数据</span>
          </Button>
          <Button
            type="text"
            className={tabClass(
              activeTab === "nongeo",
              expandedTabId === "nongeo",
            )}
            onClick={() => navigateFromHeader("/nongeo")}
            onMouseEnter={() => scheduleTabHoverExpand("nongeo")}
            onMouseLeave={collapseTabHover}
            title="非地理数据"
          >
            <BookOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span className="tab-text">非地理数据</span>
          </Button>
          {canBrowseData &&
            (dataPanel ? (
              <Popover
                trigger="click"
                placement="bottomLeft"
                open={dataPanelOpen}
                onOpenChange={onDataPanelOpenChange}
                classNames={{ root: "data-popover" }}
                styles={{
                  content: {
                    width: "min(440px, calc(100vw - 32px))",
                    maxHeight: "calc(100vh - 110px)",
                    padding: 0,
                    overflow: "auto",
                    background: "rgba(248, 250, 247, 0.92)",
                    border: "1px solid rgba(255, 255, 255, 0.34)",
                    borderRadius: 8,
                    boxShadow:
                      "0 22px 62px rgba(8, 28, 24, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.38)",
                    backdropFilter: "blur(24px) saturate(1.28)",
                  },
                }}
                content={dataPanel}
              >
                {dataButton}
              </Popover>
            ) : (
              dataButton
            ))}
          <Button
            type="text"
            className={tabClass(false, expandedTabId === "achievements")}
            onClick={() => message.info("成果目录页面正在接入")}
            onMouseEnter={() => scheduleTabHoverExpand("achievements")}
            onMouseLeave={collapseTabHover}
            title="成果目录"
          >
            <BookOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span className="tab-text">成果目录</span>
          </Button>
          <Button
            type="text"
            className={tabClass(
              activeTab === "admin",
              expandedTabId === "admin",
            )}
            onClick={() => navigateFromHeader("/admin")}
            onMouseEnter={() => scheduleTabHoverExpand("admin")}
            onMouseLeave={collapseTabHover}
            title="后台管理"
          >
            <SettingOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span className="tab-text">后台管理</span>
          </Button>
          <Popover
            trigger="click"
            placement="bottom"
            content={aboutContent}
            overlayClassName="workspace-info-popover"
          >
            <Button
              type="text"
              className={tabClass(false, expandedTabId === "about")}
              onMouseEnter={() => scheduleTabHoverExpand("about")}
              onMouseLeave={collapseTabHover}
              title="关于我们"
            >
              <InfoCircleOutlined aria-hidden="true" style={{ fontSize: 16 }} />
              <span className="tab-text">关于我们</span>
            </Button>
          </Popover>
        </nav>
      </div>

      <div className="header-account-actions">
        <Popover
          trigger="click"
          placement="bottomRight"
          content={wechatContent}
          overlayClassName="workspace-info-popover"
        >
          <Button
            aria-label="公众号二维码"
            className="wechat-button"
            icon={<QrcodeOutlined />}
            title="公众号二维码"
          />
        </Popover>
        <Popover
          trigger="click"
          placement="bottomRight"
          content={userContent}
          overlayClassName="workspace-info-popover"
        >
          <Button className="user-button">
            <span className="user-button-content">
              <Avatar
                size={24}
                src={user?.avatarUrl || undefined}
                icon={<UserOutlined />}
              />
              <span className="user-button-name">
                {user?.displayName || user?.username || ""}
              </span>
            </span>
          </Button>
        </Popover>
      </div>
    </header>
  );
}

function tabClass(active: boolean, hoverExpanded = false) {
  return [
    "workspace-switch-card",
    active ? "workspace-switch-card-active" : "",
    hoverExpanded ? "workspace-switch-card-hover-expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function clampNumber(min: number, value: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function SearchResultSection({
  title,
  icon,
  emptyText,
  children,
}: {
  title: string;
  icon: ReactNode;
  emptyText: string;
  children: ReactNode[];
}) {
  const items = children.filter(Boolean);
  return (
    <section className="workspace-search-section">
      <div className="workspace-search-section-title">
        <span>
          {icon}
          <Typography.Text strong>{title}</Typography.Text>
        </span>
        <Tag>{items.length}</Tag>
      </div>
      {items.length > 0 ? (
        <div className="workspace-search-list">{items}</div>
      ) : (
        <Empty
          className="workspace-search-empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyText}
        />
      )}
    </section>
  );
}

function resourceMatches(resource: ResourceListItem, query: string) {
  return [
    resource.name,
    resource.code,
    resource.source,
    resourceProvider(resource),
    "description" in resource ? resource.description : "",
    resourceCategoryName(resource),
    resourceFormatLabel(resource),
  ].some((value) => textMatches(value, query));
}

function sceneMatches(scene: WorkspaceScene, query: string) {
  return [
    scene.name,
    scene.description,
    scene.kind === "project" ? "工程" : "专题",
    scene.owner.displayName,
    scene.owner.username,
  ].some((value) => textMatches(value, query));
}

function achievementMatches(achievement: Achievement, query: string) {
  return [
    achievement.title,
    achievement.code,
    achievement.summary,
    achievement.source,
    achievement.category?.name,
  ].some((value) => textMatches(value, query));
}

function textMatches(value: unknown, query: string) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-CN")
    .includes(query);
}

function buildSearchCategories(
  resources: ResourceListItem[],
  workspaceScenes: WorkspaceScene[],
  achievements: Achievement[],
) {
  const categories = new Map<string, { kind: string; label: string }>();
  for (const resource of resources) {
    const category = resourceCategory(resource);
    if (category) {
      categories.set(`data-${category.name}`, {
        kind: "data",
        label: category.name,
      });
    }
  }
  if (workspaceScenes.some((scene) => scene.kind === "project")) {
    categories.set("scene-project", { kind: "scene", label: "工程" });
  }
  if (workspaceScenes.some((scene) => scene.kind === "topic")) {
    categories.set("scene-topic", { kind: "scene", label: "专题" });
  }
  for (const achievement of achievements) {
    const label = achievement.category?.name;
    if (label) {
      categories.set(`achievement-${label}`, { kind: "achievement", label });
    }
  }
  categories.set("achievement-default", { kind: "achievement", label: "成果" });
  return Array.from(categories.values()).slice(0, 18);
}

function formatSceneUpdatedAt(scene: WorkspaceScene) {
  return new Date(scene.updatedAt).toLocaleString("zh-CN", { hour12: false });
}
