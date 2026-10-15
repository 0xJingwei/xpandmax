"""生成官网的下载包；只复制明确允许公开的发布文件。"""
from pathlib import Path
import importlib.util
import shutil

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("package_script", ROOT / "scripts/package.py")
packaging = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packaging)
archive = packaging.build()
output = ROOT / "website/downloads"
output.mkdir(exist_ok=True)
shutil.copy2(archive, output / archive.name)
shutil.copy2(archive.parent / "SHA256SUMS.txt", output / "SHA256SUMS.txt")
print(f"Website ready: {ROOT / 'website'}")
