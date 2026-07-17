from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = REPO_ROOT.parent
SOURCE_MARKDOWN = (
    WORKSPACE_ROOT
    / "analysis_outputs"
    / "help_center"
    / "中亚胡杨林生态系统保护数据共享平台帮助文档.md"
)
OUTPUT_PDF = REPO_ROOT / "frontend" / "public" / "docs" / "CAPFED-help-center.pdf"

FONT_REGULAR = "MicrosoftYaHei"
FONT_BOLD = "MicrosoftYaHeiBold"


def main() -> None:
    register_fonts()
    markdown = SOURCE_MARKDOWN.read_text(encoding="utf-8-sig")
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)

    document = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="中亚胡杨林生态系统保护数据共享平台帮助文档",
        author="CAPFED",
    )
    styles = build_styles()
    story = build_story(markdown, styles)
    document.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    print(OUTPUT_PDF)


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, r"C:\Windows\Fonts\msyh.ttc"))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\msyhbd.ttc"))


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    styles = {
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Title"],
            fontName=FONT_BOLD,
            fontSize=22,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0f4f48"),
            spaceAfter=14,
            wordWrap="CJK",
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta",
            parent=base["Normal"],
            fontName=FONT_REGULAR,
            fontSize=10,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#5f716c"),
            wordWrap="CJK",
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName=FONT_BOLD,
            fontSize=15,
            leading=21,
            textColor=colors.HexColor("#0f4f48"),
            spaceBefore=10,
            spaceAfter=7,
            wordWrap="CJK",
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base["Heading3"],
            fontName=FONT_BOLD,
            fontSize=12.5,
            leading=18,
            textColor=colors.HexColor("#1f6f63"),
            spaceBefore=8,
            spaceAfter=5,
            wordWrap="CJK",
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.4,
            leading=15,
            alignment=TA_LEFT,
            textColor=colors.HexColor("#263b37"),
            spaceAfter=5,
            wordWrap="CJK",
        ),
        "list": ParagraphStyle(
            "list",
            parent=base["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=9.2,
            leading=14.5,
            leftIndent=12,
            firstLineIndent=-8,
            textColor=colors.HexColor("#263b37"),
            spaceAfter=4,
            wordWrap="CJK",
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["BodyText"],
            fontName=FONT_REGULAR,
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#263b37"),
            wordWrap="CJK",
        ),
        "cell_head": ParagraphStyle(
            "cell_head",
            parent=base["BodyText"],
            fontName=FONT_BOLD,
            fontSize=8,
            leading=11,
            textColor=colors.white,
            wordWrap="CJK",
        ),
    }
    return styles


def build_story(markdown: str, styles: dict[str, ParagraphStyle]) -> list:
    lines = markdown.splitlines()
    title = clean_inline(lines[0].lstrip("# ").strip())
    metadata = read_metadata(lines)
    story: list = [
        cover_band("CAPFED Help Center", styles),
        Spacer(1, 22),
        Paragraph(title, styles["cover_title"]),
        Paragraph(
            "面向普通用户、科研用户、数据管理员和系统管理员的使用说明、操作流程与常见问题。",
            styles["cover_meta"],
        ),
        Spacer(1, 16),
        build_cover_table(metadata, styles),
        Spacer(1, 18),
        Paragraph(
            "本版文档按平台当前功能重新整理，侧重用户实际操作，不列出源码路径和内部资料清单；需要反馈问题时，请提供页面、数据名称、截图和复现步骤。",
            styles["body"],
        ),
        Spacer(1, 10),
        Paragraph("阅读路径", styles["h3"]),
        build_cover_reading_table(styles),
        PageBreak(),
    ]

    index = 1
    skipped_metadata = False
    while index < len(lines):
      line = lines[index].strip()
      if not line:
          story.append(Spacer(1, 3))
          index += 1
          continue
      if not skipped_metadata and is_table_start(lines, index):
          while index < len(lines) and lines[index].strip().startswith("|"):
              index += 1
          skipped_metadata = True
          continue
      if is_table_start(lines, index):
          table_lines: list[str] = []
          while index < len(lines) and lines[index].strip().startswith("|"):
              table_lines.append(lines[index].strip())
              index += 1
          story.append(build_table(table_lines, styles))
          story.append(Spacer(1, 6))
          continue
      if line.startswith("## "):
          story.append(Paragraph(clean_inline(line[3:]), styles["h2"]))
      elif line.startswith("### "):
          story.append(Paragraph(clean_inline(line[4:]), styles["h3"]))
      elif re.match(r"^\d+\.\s+", line):
          story.append(Paragraph(clean_inline(line), styles["list"]))
      elif line.startswith("- "):
          story.append(Paragraph("- " + clean_inline(line[2:]), styles["list"]))
      else:
          story.append(Paragraph(clean_inline(line), styles["body"]))
      index += 1
    return story


def read_metadata(lines: list[str]) -> dict[str, str]:
    metadata: dict[str, str] = {}
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) >= 2 and parts[0] not in {"项目", "---"}:
            metadata[parts[0]] = parts[1]
    return metadata


def cover_band(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    table = Table([[Paragraph(text, styles["cell_head"])]], colWidths=[A4[0] - 36 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0B4F46")),
                ("BOX", (0, 0), (-1, -1), 0, colors.HexColor("#0B4F46")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def build_cover_table(metadata: dict[str, str], styles: dict[str, ParagraphStyle]) -> Table:
    rows = [
        ["文档版本", metadata.get("文档版本", "")],
        ["更新日期", metadata.get("更新日期", "")],
        ["适用平台", metadata.get("适用平台", "")],
        ["适用对象", metadata.get("适用对象", "")],
    ]
    data = [[Paragraph(clean_inline(cell), styles["cell"]) for cell in row] for row in rows]
    table = Table(data, colWidths=[34 * mm, A4[0] - 70 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cddbd8")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f1ee")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return table


def build_cover_reading_table(styles: dict[str, ParagraphStyle]) -> Table:
    rows = [
        ["普通用户", "快速上手、地理数据工作台、空间查询"],
        ["科研用户", "数据准备规范、数据导入、工程与专题管理"],
        ["数据管理员", "存量数据维护、工程与专题管理、权限与日志"],
        ["系统管理员", "后台管理、备份与安全、常见问题"],
    ]
    data = [[Paragraph(clean_inline(cell), styles["cell"]) for cell in row] for row in rows]
    table = Table(data, colWidths=[30 * mm, A4[0] - 66 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d4e1de")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f1f7f5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def is_table_start(lines: list[str], index: int) -> bool:
    if index + 1 >= len(lines):
        return False
    current = lines[index].strip()
    divider = lines[index + 1].strip()
    return current.startswith("|") and divider.startswith("|") and "---" in divider


def build_table(table_lines: list[str], styles: dict[str, ParagraphStyle]) -> Table:
    rows = [parse_table_row(line) for line in table_lines]
    rows = [row for row in rows if not all(set(cell) <= {"-", ":", " "} for cell in row)]
    col_count = max(len(row) for row in rows)
    normalized = [row + [""] * (col_count - len(row)) for row in rows]
    data = []
    for row_index, row in enumerate(normalized):
        style = styles["cell_head"] if row_index == 0 else styles["cell"]
        data.append([Paragraph(clean_inline(cell), style) for cell in row])

    width = A4[0] - 36 * mm
    col_widths = [width / col_count] * col_count
    table = Table(data, colWidths=col_widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f6f63")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#cddbd8")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3faf7")]),
            ]
        )
    )
    return table


def parse_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip("|").split("|")]


def clean_inline(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    text = text.replace("`", "")
    text = text.replace("&", "&amp;").replace("<b>", "<b>").replace("</b>", "</b>")
    return text


def draw_footer(canvas, document) -> None:
    canvas.saveState()
    canvas.setFont(FONT_REGULAR, 8)
    canvas.setFillColor(colors.HexColor("#6f817c"))
    canvas.drawRightString(
        document.pagesize[0] - 18 * mm,
        9 * mm,
        f"CAPFED 帮助文档 - 第 {document.page} 页",
    )
    canvas.restoreState()


if __name__ == "__main__":
    main()
