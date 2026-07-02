import {
  ApartmentOutlined,
  AppstoreOutlined,
  BookOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  ImportOutlined,
  LogoutOutlined,
  QrcodeOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { MenuProps, TourProps } from "antd";
import {
  App,
  Avatar,
  Button,
  Dropdown,
  Empty,
  Input,
  Popover,
  QRCode,
  Tag,
  Tour,
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
import capfedLogoWhite from "../assets/capfed-logo-white.svg";
import { useAppContext } from "../contexts/AppContext";
import type {
  DataDomainType,
  DataSchemaCatalogNode,
  DataSchemaSummary,
  ResourceListItem,
  WorkspaceScene,
} from "../types";
import {
  resourceCategoryName,
  resourceFormatLabel,
  resourceProvider,
} from "../utils/resources";
import { clearCachedLayerGroups } from "../utils/layerWorkspaceStorage";
import { aboutSections } from "../about/aboutSections";

export type WorkspaceTab = "map" | "nongeo" | "resources" | "admin" | "about";

const platformChineseName = "中亚胡杨林生态系统保护数据共享平台";
const hoverExpandDelayMs = 100;
const searchOpenDelayMs = 400;
const workspaceTourStoragePrefix = "huyang-system.workspace-tour.v1";

interface WorkspaceHeaderProps {
  activeTab: WorkspaceTab;
  canBrowseData: boolean;
  resources?: ResourceListItem[];
  workspaceScenes?: WorkspaceScene[];
  dataSchema?: DataSchemaSummary | null;
  selectedDomainType?: DataDomainType | null;
  searchKeyword?: string;
  onGlobalSearch?: (keyword: string) => void;
  onSelectDataDomain?: (
    domainType: DataDomainType | null,
    node: DataSchemaCatalogNode | null,
  ) => void;
  onQuickLoadResource?: (resource: ResourceListItem) => Promise<void> | void;
  onLoadWorkspaceScene?: (scene: WorkspaceScene) => void;
  onSearchFocus?: () => void;
}

export default function WorkspaceHeader({
  activeTab,
  canBrowseData,
  resources,
  workspaceScenes,
  dataSchema,
  selectedDomainType,
  searchKeyword = "",
  onGlobalSearch,
  onSelectDataDomain,
  onQuickLoadResource,
  onLoadWorkspaceScene,
  onSearchFocus,
}: WorkspaceHeaderProps) {
  const { bootstrap, user, setUser } = useAppContext();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickLoadingResourceId, setQuickLoadingResourceId] = useState<
    ResourceListItem["id"] | null
  >(null);
  const [localResources, setLocalResources] = useState<ResourceListItem[]>([]);
  const [localWorkspaceScenes, setLocalWorkspaceScenes] = useState<
    WorkspaceScene[]
  >([]);
  const [localDataSchema, setLocalDataSchema] =
    useState<DataSchemaSummary | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchCompact, setSearchCompact] = useState(false);
  const [navCompressed, setNavCompressed] = useState(false);
  const [navMeasured, setNavMeasured] = useState(false);
  const [expandedTabId, setExpandedTabId] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [searchPopoverWidth, setSearchPopoverWidth] = useState<
    number | undefined
  >();
  const searchNavRef = useRef<HTMLDivElement | null>(null);
  const searchContainerRef = useRef<HTMLElement | null>(null);
  const primaryNavRef = useRef<HTMLElement | null>(null);
  const mapTabRef = useRef<HTMLButtonElement | null>(null);
  const nonGeoTabRef = useRef<HTMLButtonElement | null>(null);
  const resourcesTabRef = useRef<HTMLButtonElement | null>(null);
  const adminTabRef = useRef<HTMLButtonElement | null>(null);
  const aboutTabRef = useRef<HTMLButtonElement | null>(null);
  const userButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchOpenTimerRef = useRef<number | null>(null);
  const tabHoverTimerRef = useRef<number | null>(null);
  const navMeasureTimerRef = useRef<number | null>(null);
  const layoutMeasureFrameRef = useRef<number | null>(null);
  const fullPrimaryNavWidthRef = useRef(0);
  const effectiveResources = resources ?? localResources;
  const effectiveWorkspaceScenes = workspaceScenes ?? localWorkspaceScenes;
  const effectiveDataSchema = dataSchema ?? localDataSchema;
  const domainTypeLabelByValue = useMemo(
    () => domainTypeLabels(effectiveDataSchema),
    [effectiveDataSchema],
  );
  const isGuestUser =
    user?.username === "guest" || Boolean(user?.roles.includes("游客"));
  const showAdminTab =
    Boolean(user?.permissions.canAccessAdmin) && !isGuestUser;
  const showDataImportShortcut = Boolean(user?.permissions.canUploadData);
  const tourStorageKey = user
    ? `${workspaceTourStoragePrefix}.${user.id}.${user.username}`
    : null;

  useEffect(() => {
    setSearchText(searchKeyword);
  }, [searchKeyword]);

  useEffect(() => {
    if (!user || !tourStorageKey) {
      setTourOpen(false);
      return;
    }
    try {
      setTourOpen(window.localStorage.getItem(tourStorageKey) !== "completed");
    } catch {
      setTourOpen(true);
    }
  }, [tourStorageKey, user]);

  useEffect(() => {
    if (
      !canBrowseData ||
      (resources !== undefined && workspaceScenes !== undefined)
    ) {
      return;
    }
    let mounted = true;
    async function loadGlobalSearchItems() {
      try {
        const [resourceResponse, sceneResponse] = await Promise.all([
          resources === undefined ? api.resources({}) : null,
          workspaceScenes === undefined ? api.workspaces() : null,
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
  }, [canBrowseData, message, resources, workspaceScenes]);

  useEffect(() => {
    if (!canBrowseData || dataSchema !== undefined) {
      return;
    }
    const loadSchema = (api as { dataSchemaSummary?: typeof api.dataSchemaSummary })
      .dataSchemaSummary;
    if (!loadSchema) {
      return;
    }
    let mounted = true;
    loadSchema()
      .then((result) => {
        if (mounted) {
          setLocalDataSchema(result);
        }
      })
      .catch(() => {
        if (mounted) {
          setLocalDataSchema(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, [canBrowseData, dataSchema]);

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

  const scheduleLayoutMeasure = useCallback(() => {
    if (layoutMeasureFrameRef.current !== null) {
      return;
    }
    layoutMeasureFrameRef.current = window.requestAnimationFrame(() => {
      layoutMeasureFrameRef.current = null;
      syncSearchPopoverWidth();
      measureNavFit();
    });
  }, [measureNavFit, syncSearchPopoverWidth]);

  const expandSearch = useCallback(() => {
    setSearchExpanded(true);
    scheduleLayoutMeasure();
  }, [scheduleLayoutMeasure]);

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
    scheduleLayoutMeasure();
  }, [scheduleLayoutMeasure]);

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
    scheduleLayoutMeasure();
    const observer = new ResizeObserver(scheduleLayoutMeasure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleLayoutMeasure]);

  useLayoutEffect(() => {
    const nav = searchNavRef.current;
    const search = searchContainerRef.current;
    const primaryNav = primaryNavRef.current;
    if (!nav || !search || !primaryNav) return;

    scheduleLayoutMeasure();
    const observer = new ResizeObserver(scheduleLayoutMeasure);
    observer.observe(nav);
    observer.observe(search);
    observer.observe(primaryNav);
    return () => observer.disconnect();
  }, [scheduleLayoutMeasure]);

  useLayoutEffect(() => {
    scheduleLayoutMeasure();
  }, [scheduleLayoutMeasure]);

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
      if (layoutMeasureFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutMeasureFrameRef.current);
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
        searchQuery
          ? resourceMatches(resource, searchQuery, domainTypeLabelByValue)
          : true,
      ),
    [domainTypeLabelByValue, effectiveResources, searchQuery],
  );
  const filteredWorkspaceScenes = useMemo(
    () =>
      effectiveWorkspaceScenes.filter((scene) =>
        searchQuery ? sceneMatches(scene, searchQuery) : true,
      ),
    [effectiveWorkspaceScenes, searchQuery],
  );
  const filteredProjectScenes = useMemo(
    () => filteredWorkspaceScenes.filter((scene) => scene.kind === "project"),
    [filteredWorkspaceScenes],
  );
  const filteredTopicScenes = useMemo(
    () => filteredWorkspaceScenes.filter((scene) => scene.kind === "topic"),
    [filteredWorkspaceScenes],
  );

  async function handleLogout() {
    try {
      await api.logout();
    } catch (error) {
      message.warning(
        error instanceof Error ? error.message : "退出接口异常，本地会话已清空",
      );
    } finally {
      try {
        await clearCachedLayerGroups();
      } catch (error) {
        console.warn("清理本地图层缓存失败", error);
      }
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
    onGlobalSearch?.(keyword);
    closeSearchPanel();
  }

  async function quickLoadResource(resource: ResourceListItem) {
    if (onQuickLoadResource) {
      setQuickLoadingResourceId(resource.id);
      try {
        await onQuickLoadResource(resource);
        closeSearchPanel();
      } finally {
        setQuickLoadingResourceId((current) =>
          current === resource.id ? null : current,
        );
      }
      return;
    }
    navigate(`/map?resourceQ=${encodeURIComponent(resource.name)}`);
    onGlobalSearch?.(resource.name);
    closeSearchPanel();
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

  const selectDataDomain = useCallback(
    (
      domainType: DataDomainType | null,
      node: DataSchemaCatalogNode | null,
      targetTab: "map" | "nongeo",
    ) => {
      dismissSearchForNavigation();
      if (targetTab === "map" && onSelectDataDomain) {
        onSelectDataDomain(domainType, node);
        return;
      }
      if (!domainType) {
        navigate(`/${targetTab}`);
        return;
      }
      navigate(`/${targetTab}?domainType=${encodeURIComponent(domainType)}`);
    },
    [dismissSearchForNavigation, navigate, onSelectDataDomain],
  );

  const handleAiInterpretationPlaceholder = useCallback(() => {
    dismissSearchForNavigation();
    message.info("智能解译功能按钮已预留，暂未接入后端服务", 1.2);
  }, [dismissSearchForNavigation, message]);

  function handleResourceCenter() {
    if (!canBrowseData && !showAdminTab) {
      message.warning("当前账号暂无数据资源浏览权限");
      return;
    }
    navigateFromHeader("/resources");
  }

  const dataManagementMenuItems = useMemo<MenuProps["items"]>(() => {
    const items: NonNullable<MenuProps["items"]> = [
      {
        key: "resources-dashboard",
        label: "数据概览",
        onClick: () => navigateFromHeader("/resources/dashboard"),
      },
    ];
    if (
      user?.permissions.canViewDataResources ||
      user?.permissions.canChangeDataResources ||
      user?.permissions.canDeleteDataResources ||
      user?.permissions.canUploadData ||
      user?.permissions.canExportData
    ) {
      items.push({
        key: "resources-inventory",
        label: "存量数据",
        onClick: () => navigateFromHeader("/resources/data/inventory"),
      });
    }
    if (
      user?.permissions.canViewWorkspaces ||
      user?.permissions.canChangeWorkspaces ||
      user?.permissions.canDeleteWorkspaces
    ) {
      items.push({
        key: "resources-projects",
        label: "工程管理",
        onClick: () => navigateFromHeader("/resources/manage/projects"),
      });
      items.push({
        key: "resources-topics",
        label: "专题管理",
        onClick: () => navigateFromHeader("/resources/manage/topics"),
      });
    }
    if (user?.permissions.canUploadData) {
      items.push({
        key: "resources-import",
        label: "数据导入",
        onClick: () => navigateFromHeader("/resources/data/import"),
      });
    }
    return items;
  }, [
    navigateFromHeader,
    user?.permissions.canExportData,
    user?.permissions.canChangeDataResources,
    user?.permissions.canChangeWorkspaces,
    user?.permissions.canDeleteDataResources,
    user?.permissions.canDeleteWorkspaces,
    user?.permissions.canUploadData,
    user?.permissions.canViewDataResources,
    user?.permissions.canViewWorkspaces,
  ]);

  const adminMenuItems = useMemo<MenuProps["items"]>(() => {
    const items: NonNullable<MenuProps["items"]> = [
      {
        key: "admin-dashboard",
        label: "运行概览",
        onClick: () => navigateFromHeader("/admin/dashboard"),
      },
      {
        key: "admin-profile",
        label: "用户设置",
        onClick: () => navigateFromHeader("/admin/profile"),
      },
    ];
    if (
      user?.permissions.canViewOperationLogs ||
      user?.permissions.canViewOwnOperationLogs
    ) {
      items.push({
        key: "admin-logs",
        label: "日志管理",
        onClick: () => navigateFromHeader("/admin/logs"),
      });
    }
    if (user?.permissions.canManageSystemSettings) {
      items.push({
        key: "admin-settings",
        label: "系统设置",
        onClick: () => navigateFromHeader("/admin/settings"),
      });
    }
    if (user?.permissions.canManageDataBackup) {
      items.push({
        key: "admin-backup",
        label: "数据备份",
        onClick: () => navigateFromHeader("/admin/backup"),
      });
    }
    if (user?.permissions.canManageAuth) {
      items.push(
        {
          key: "admin-users",
          label: "用户管理",
          onClick: () => navigateFromHeader("/admin/auth/users"),
        },
        {
          key: "admin-groups",
          label: "角色权限",
          onClick: () => navigateFromHeader("/admin/auth/groups"),
        },
      );
    }
    return items;
  }, [
    navigateFromHeader,
    user?.permissions.canManageAuth,
    user?.permissions.canManageDataBackup,
    user?.permissions.canManageSystemSettings,
    user?.permissions.canViewOperationLogs,
    user?.permissions.canViewOwnOperationLogs,
  ]);

  const aboutMenuItems = useMemo<MenuProps["items"]>(
    () =>
      aboutSections.map((section) => ({
        key: section.key,
        label: section.title,
        onClick: () => navigateFromHeader(section.path),
      })),
    [navigateFromHeader],
  );

  const geoCatalogNode = useMemo(
    () => dataCatalogGroup(effectiveDataSchema, "geo"),
    [effectiveDataSchema],
  );
  const nonGeoCatalogNode = useMemo(
    () => dataCatalogGroup(effectiveDataSchema, "nongeo"),
    [effectiveDataSchema],
  );
  const geoDataMenuItems = useMemo<MenuProps["items"]>(
    () =>
      dataDomainMenuItems(
        geoCatalogNode,
        selectedDomainType,
        selectDataDomain,
        "map",
      ),
    [geoCatalogNode, selectedDomainType, selectDataDomain],
  );
  const nonGeoDataMenuItems = useMemo<MenuProps["items"]>(
    () =>
      dataDomainMenuItems(
        nonGeoCatalogNode,
        selectedDomainType,
        selectDataDomain,
        "nongeo",
      ),
    [nonGeoCatalogNode, selectedDomainType, selectDataDomain],
  );

  const finishTour = useCallback(() => {
    setTourOpen(false);
    if (!tourStorageKey) {
      return;
    }
    try {
      window.localStorage.setItem(tourStorageKey, "completed");
    } catch {
      // 本地存储不可用时，仅在当前页面会话内关闭引导。
    }
  }, [tourStorageKey]);

  const showWorkspaceTour = useCallback(() => {
    setUserPopoverOpen(false);
    closeSearchPanel();
    setTourOpen(true);
  }, [closeSearchPanel]);

  const tourSteps = useMemo<TourProps["steps"]>(() => {
    const steps: NonNullable<TourProps["steps"]> = [
      {
        title: "🎉 欢迎 🎉",
        description:
          "欢迎使用中亚胡杨林生态系统保护数据共享平台，下面快速熟悉工作台入口。",
        target: null,
      },
      {
        title: "全局搜索",
        description:
          "检索数据资源、已保存工程和专题，并从结果中加载到当前工作台。",
        target: () => searchContainerRef.current ?? document.body,
        placement: "bottom",
      },
      {
        title: "地理数据",
        description:
          "进入三维地球工作台，浏览空间数据、加载图层、执行空间查询并查看要素属性。",
        target: () => mapTabRef.current ?? document.body,
        placement: "bottom",
      },
      {
        title: "非地理数据",
        description:
          "查看生态表格、基因等非空间数据，并使用图表与表格完成基础分析。",
        target: () => nonGeoTabRef.current ?? document.body,
        placement: "bottom",
      },
    ];

    if (canBrowseData || showAdminTab) {
      steps.push({
        title: "数据管理",
        description:
          "浏览数据概览、维护存量数据或发起数据导入；可见菜单会按账号权限自动收敛。",
        target: () => resourcesTabRef.current ?? document.body,
        placement: "bottom",
      });
    }

    if (showAdminTab) {
      steps.push({
        title: "后台管理",
        description:
          "进入运行概览、个人设置、操作日志、系统设置、数据备份以及角色权限等管理功能。",
        target: () => adminTabRef.current ?? document.body,
        placement: "bottom",
      });
    }

    steps.push(
      {
        title: "关于我们",
        description:
          "查看系统简介、团队介绍、团队成员、胡杨知识和帮助文档等占位栏目。",
        target: () => aboutTabRef.current ?? document.body,
        placement: "bottom",
      },
      {
        title: "个人入口",
        description: "查看个人信息、进入个人设置或安全退出当前账号。",
        target: () => userButtonRef.current ?? document.body,
        placement: "bottomRight",
      },
    );

    return steps;
  }, [canBrowseData, showAdminTab]);

  const dataButton = (
    <Dropdown
      menu={{ items: dataManagementMenuItems }}
      trigger={["hover"]}
      placement="bottom"
      classNames={{ root: "workspace-management-dropdown" }}
    >
      <Button
        ref={resourcesTabRef}
        type="text"
        className={`${tabClass(
          activeTab === "resources",
          expandedTabId === "resource",
        )} workspace-switch-card-data-management`}
        onClick={handleResourceCenter}
        onMouseEnter={() => scheduleTabHoverExpand("resource")}
        onMouseLeave={collapseTabHover}
        title="数据管理"
      >
        <FolderOpenOutlined aria-hidden="true" style={{ fontSize: 16 }} />
        <span className="tab-text">数据管理</span>
      </Button>
    </Dropdown>
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
        <Button
          size="small"
          icon={<QuestionCircleOutlined />}
          onClick={showWorkspaceTour}
        >
          显示引导
        </Button>
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
            <span className="workspace-search-row-main">
              <strong>{resource.name}</strong>
              <small>
                {resourceDomainCategoryName(resource, domainTypeLabelByValue) ??
                  "未分类"}{" "}
                ·{" "}
                {resourceFormatLabel(resource)}
              </small>
            </span>
            <Button
              size="small"
              type="primary"
              ghost
              disabled={!resource.isQueryable && !resource.isRenderable}
              loading={quickLoadingResourceId === resource.id}
              onClick={() => void quickLoadResource(resource)}
            >
              快速加载
            </Button>
          </div>
        ))}
      </SearchResultSection>

      <SearchResultSection
        title="工程"
        icon={<FolderOpenOutlined style={{ fontSize: 15 }} />}
        emptyText="暂无匹配工程"
      >
        {filteredProjectScenes.map((scene) => (
          <div className="workspace-search-row" key={`scene-${scene.id}`}>
            <span className="workspace-search-row-main">
              <strong>{scene.name}</strong>
              <small>{scene.description || formatSceneUpdatedAt(scene)}</small>
            </span>
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => openWorkspaceScene(scene)}
            >
              加载
            </Button>
          </div>
        ))}
      </SearchResultSection>

      <SearchResultSection
        title="专题"
        icon={<AppstoreOutlined style={{ fontSize: 15 }} />}
        emptyText="暂无匹配专题"
      >
        {filteredTopicScenes.map((scene) => (
          <div className="workspace-search-row" key={`scene-${scene.id}`}>
            <span className="workspace-search-row-main">
              <strong>{scene.name}</strong>
              <small>{scene.description || formatSceneUpdatedAt(scene)}</small>
            </span>
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => openWorkspaceScene(scene)}
            >
              加载
            </Button>
          </div>
        ))}
      </SearchResultSection>
    </section>
  );

  return (
    <header
      className={`workspace-header${navMeasured ? " workspace-header-nav-measured" : " workspace-header-nav-measuring"}${searchExpanded ? " workspace-header-search-active" : ""}${searchCompact ? " workspace-header-search-compact" : ""}${navCompressed ? " workspace-header-nav-compressed" : ""}`}
    >
      <div className="brand-block">
        <span className="brand-logo-frame">
          <img
            src={capfedLogoWhite}
            alt={`${bootstrap.systemName} Logo`}
            width={40}
            height={40}
          />
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
              placeholder="搜索数据、工程、专题"
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
          <Dropdown
            menu={{ items: geoDataMenuItems }}
            trigger={["hover"]}
            placement="bottom"
            classNames={{ root: "workspace-management-dropdown" }}
          >
            <Button
              ref={mapTabRef}
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
          </Dropdown>
          <Dropdown
            menu={{ items: nonGeoDataMenuItems }}
            trigger={["hover"]}
            placement="bottom"
            classNames={{ root: "workspace-management-dropdown" }}
          >
            <Button
              ref={nonGeoTabRef}
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
          </Dropdown>
          <Button
            type="text"
            className={tabClass(false, expandedTabId === "ai")}
            onClick={handleAiInterpretationPlaceholder}
            onMouseEnter={() => scheduleTabHoverExpand("ai")}
            onMouseLeave={collapseTabHover}
            title="智能解译（占位）"
          >
            <RobotOutlined aria-hidden="true" style={{ fontSize: 16 }} />
            <span className="tab-text">智能解译</span>
          </Button>
          {(canBrowseData || showAdminTab) && dataButton}
          {showAdminTab && (
            <Dropdown
              menu={{ items: adminMenuItems }}
              trigger={["hover"]}
              placement="bottom"
              classNames={{ root: "workspace-management-dropdown" }}
            >
              <Button
                ref={adminTabRef}
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
            </Dropdown>
          )}
          <Dropdown
            menu={{ items: aboutMenuItems }}
            trigger={["hover"]}
            placement="bottom"
            classNames={{ root: "workspace-management-dropdown" }}
          >
            <Button
              ref={aboutTabRef}
              type="text"
              className={tabClass(
                activeTab === "about",
                expandedTabId === "about",
              )}
              onClick={() => navigateFromHeader("/about/system")}
              onMouseEnter={() => scheduleTabHoverExpand("about")}
              onMouseLeave={collapseTabHover}
              title="关于我们"
            >
              <InfoCircleOutlined aria-hidden="true" style={{ fontSize: 16 }} />
              <span className="tab-text">关于我们</span>
            </Button>
          </Dropdown>
        </nav>
      </div>

      <div className="header-account-actions">
        {showDataImportShortcut && (
          <Button
            type="text"
            aria-label="数据导入"
            className="data-import-shortcut"
            icon={<ImportOutlined />}
            onClick={() => navigateFromHeader("/resources/data/import")}
            title="数据导入"
          >
            <span className="data-import-shortcut-text">数据导入</span>
          </Button>
        )}
        <Popover
          trigger="click"
          placement="bottomRight"
          content={wechatContent}
          classNames={{ root: "workspace-info-popover" }}
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
          open={userPopoverOpen}
          onOpenChange={setUserPopoverOpen}
          classNames={{ root: "workspace-info-popover" }}
        >
          <Button
            ref={userButtonRef}
            aria-label="用户信息"
            className="user-button"
          >
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
      <Tour
        open={tourOpen}
        steps={tourSteps}
        onClose={finishTour}
        onFinish={finishTour}
        mask={{ color: "rgba(6, 18, 24, 0.52)" }}
      />
    </header>
  );
}

const fallbackCatalogTree: DataSchemaCatalogNode[] = [
  {
    code: "geo",
    name: "地理数据",
    domainType: null,
    spatialClass: "spatial",
    children: [
      domainNode("geo-germplasm", "种质数据", "germplasm"),
      domainNode("geo-individual", "个体数据", "individual"),
      domainNode("geo-community", "群落数据", "community"),
      domainNode("geo-population", "种群数据", "population"),
      domainNode("geo-field-survey", "野外调查数据", "field_survey"),
      domainNode("geo-remote-sensing", "遥感影像数据", "remote_sensing"),
    ],
  },
  {
    code: "nongeo",
    name: "非地理数据",
    domainType: null,
    spatialClass: "non_spatial",
    children: [
      domainNode("nongeo-molecular", "分子数据", "molecular"),
      domainNode("nongeo-genome", "基因组数据", "genome"),
    ],
  },
];

function domainNode(
  code: string,
  name: string,
  domainType: DataDomainType,
): DataSchemaCatalogNode {
  return {
    code,
    name,
    domainType,
    spatialClass: null,
    children: [],
  };
}

function dataCatalogGroup(
  schema: DataSchemaSummary | null | undefined,
  code: "geo" | "nongeo",
) {
  return (
    schema?.catalogTree.find((node) => node.code === code) ??
    fallbackCatalogTree.find((node) => node.code === code) ??
    null
  );
}

function dataDomainMenuItems(
  root: DataSchemaCatalogNode | null,
  selectedDomainType: DataDomainType | null | undefined,
  onSelect: (
    domainType: DataDomainType | null,
    node: DataSchemaCatalogNode | null,
    targetTab: "map" | "nongeo",
  ) => void,
  targetTab: "map" | "nongeo",
): MenuProps["items"] {
  const children = root?.children ?? [];
  const allDataItem = {
    key: `${root?.code ?? targetTab}-all`,
    label: selectedDomainType ? "全部数据" : "全部数据 · 当前",
    onClick: () => onSelect(null, null, targetTab),
  };
  if (!children.length) {
    return [
      allDataItem,
      {
        key: `${root?.code ?? "data"}-empty`,
        label: "暂无可选数据类型",
        disabled: true,
      },
    ];
  }
  const domainItems = children
    .filter((node): node is DataSchemaCatalogNode & { domainType: DataDomainType } =>
      Boolean(node.domainType),
    )
    .map((node) => ({
      key: node.code,
      label:
        node.domainType === selectedDomainType ? `${node.name} · 当前` : node.name,
      onClick: () => onSelect(node.domainType, node, targetTab),
    }));
  return [allDataItem, { type: "divider" }, ...domainItems];
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

function domainTypeLabels(schema: DataSchemaSummary | null | undefined) {
  const labels = new Map<DataDomainType, string>();
  schema?.domains.forEach((domain) => labels.set(domain.code, domain.name));
  collectDomainLabels(fallbackCatalogTree, labels);
  collectDomainLabels(schema?.catalogTree ?? [], labels);
  return labels;
}

function collectDomainLabels(
  nodes: DataSchemaCatalogNode[],
  labels: Map<DataDomainType, string>,
) {
  nodes.forEach((node) => {
    if (node.domainType && !labels.has(node.domainType)) {
      labels.set(node.domainType, node.name);
    }
    collectDomainLabels(node.children, labels);
  });
}

function resourceDomainCategoryName(
  resource: ResourceListItem,
  domainTypeLabelByValue: Map<DataDomainType, string>,
) {
  if (resource.domainType) {
    return (
      domainTypeLabelByValue.get(resource.domainType) ??
      resourceCategoryName(resource)
    );
  }
  return resourceCategoryName(resource);
}

function resourceMatches(
  resource: ResourceListItem,
  query: string,
  domainTypeLabelByValue: Map<DataDomainType, string>,
) {
  return [
    resource.name,
    resource.code,
    resource.source,
    resourceProvider(resource),
    "description" in resource ? resource.description : "",
    resourceDomainCategoryName(resource, domainTypeLabelByValue),
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

function textMatches(value: unknown, query: string) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-CN")
    .includes(query);
}

function formatSceneUpdatedAt(scene: WorkspaceScene) {
  return new Date(scene.updatedAt).toLocaleString("zh-CN", { hour12: false });
}
