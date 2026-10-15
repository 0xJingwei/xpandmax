"""生成原创几何图标和商店宣传图；仅制作素材时需要 Pillow。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]


def icon(size):
    scale = 4
    im = Image.new("RGBA", (128 * scale, 128 * scale))
    d = ImageDraw.Draw(im)
    def box(coords): return tuple(round(v * scale) for v in coords)
    d.rounded_rectangle(box((2, 2, 126, 126)), radius=31 * scale, fill="#C5F467")
    # 四角向外展开，与官网品牌标记保持一致。
    for points in [[(38,38),(62,38)],[(38,38),(38,62)],[(38,38),(60,60)],
                   [(90,90),(66,90)],[(90,90),(90,66)],[(90,90),(68,68)],
                   [(68,38),(90,38),(90,60)],[(90,38),(68,60)],
                   [(60,90),(38,90),(38,68)],[(38,90),(60,68)]]:
        d.line([(int(x*scale),int(y*scale)) for x,y in points], fill="#19221B", width=7*scale, joint="curve")
    return im.resize((size, size), Image.Resampling.LANCZOS)


def make_assets():
    icons = ROOT / "extension/icons"
    icons.mkdir(exist_ok=True)
    for size in [16, 32, 48, 128]:
        icon(size).save(icons / f"icon{size}.png")
    out = ROOT / "store"
    # 放大绘制再缩小，让小尺寸文字和边缘清晰。
    im = Image.new("RGB", (880, 560), "#1E2823")
    d = ImageDraw.Draw(im)
    font_path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    if not font_path.exists():
        font_path = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    def font(size): return ImageFont.truetype(str(font_path), size)
    logo = icon(156)
    im.paste(logo, (56, 46), logo)
    d.text((234, 71), "XpandMax", fill="white", font=font(43))
    d.text((234, 130), "Connect with a bigger world on X.", fill="#A8C2D9", font=font(24))
    for y, name, count in [(250, "Demo Author", "12.3K"), (372, "Demo Builder", "913")]:
        d.rounded_rectangle((62, y, 818, y + 92), radius=20, fill="#1C334C")
        d.ellipse((84, y + 22, 132, y + 70), fill="#3D719E")
        d.text((158, y + 27), name, fill="white", font=font(29))
        d.rounded_rectangle((571, y + 20, 788, y + 72), radius=10, fill="#DFF2FF")
        d.text((589, y + 32), "Followers " + count, fill="#0B649F", font=font(22))
    im.resize((440, 280), Image.Resampling.LANCZOS).save(out / "promo-440x280.png")


if __name__ == "__main__":
    make_assets()
