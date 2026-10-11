import { TFile, normalizePath, requestUrl, type App } from 'obsidian';
import { decodeSvgDataUrl } from './covers';
import { coverPath } from './persistence';

export async function readCoverSvg(app: App, source: string, sourcePath = ''): Promise<string> {
  const path = coverPath(source);
  if (/^data:image\/svg\+xml[;,]/i.test(path)) return decodeSvgDataUrl(path);
  if (/^https?:\/\//i.test(path)) {
    const response = await requestUrl({ url: path, method: 'GET', throw: false });
    if (response.status < 200 || response.status >= 300) throw new Error('封面读取失败。');
    return response.text;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) throw new Error('此封面地址不能作为库内 SVG 读取。');
  const file = app.metadataCache.getFirstLinkpathDest(path, sourcePath) ?? app.vault.getAbstractFileByPath(normalizePath(path));
  if (!(file instanceof TFile) || file.extension.toLowerCase() !== 'svg') throw new Error('SVG 封面文件不存在。');
  return app.vault.read(file);
}
