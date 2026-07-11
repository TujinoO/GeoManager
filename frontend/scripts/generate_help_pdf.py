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
    story: list = [
        Spacer(1, 32),
        Paragraph(title, styles["cover_title"]),
        Paragraph("Help Center / 用户帮助中心", styles["cover_meta"]),
        Spacer(1, 12),
        Paragraph("面向普通用户、科研用户、数据管理员和系统管理员", styles["cover_meta"]),
        Paragraph("版本 v1.0 - 2026年7月10日", styles["cover_meta"]),
        PageBreak(),
    ]

    index = 1
    while index < len(lines):
      line = lines[index].strip()
      if not line:
          story.append(Spacer(1, 3))
          index += 1
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
