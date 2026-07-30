from __future__ import annotations

PLATFORM_CHINESE_NAME = "全球胡杨林生态系统保护数据共享平台"
PLATFORM_ENGLISH_NAME = (
    "Global Populus euphratica Forest Ecosystem Conservation Data Sharing Platform"
)
PLATFORM_ABBREVIATION = "GPEDSP"
PLATFORM_EDITION = "GPEDSP · WebGIS Research Edition"

LEGACY_PLATFORM_NAMES = frozenset(
    {
        "中亚胡杨林生态系统保护数据共享平台",
        "中亚胡杨林生态保护数据共享平台",
        "中亚胡杨林生态数据共享平台",
        "中亚胡杨生态系统保护数据共享平台",
        "中亚胡杨生态数据门户",
    }
)


def canonicalize_platform_name(value: object) -> str:
    """Upgrade known legacy brand names while preserving custom deployment names."""
    name = str(value or "").strip()
    return PLATFORM_CHINESE_NAME if name in LEGACY_PLATFORM_NAMES else name
