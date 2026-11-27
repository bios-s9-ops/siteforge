import type { SiteBlock, SiteMutation, SitePage, SiteProject } from '../types/site';
import { DEFAULT_NAVBAR_CONFIG } from './siteSettings';
import { getSiteSettings, serializeSafeBlockCss } from './siteSettings';
import { normalizeProjectPages } from './projectIO';

function pageFor(project: SiteProject, id: string): SitePage | undefined {
  return project.pages?.find((page) => page.id === id);
}

function replacePageBlocks(project: SiteProject, pageId: string, blocks: SiteBlock[]): SiteProject {
  const pages = project.pages ?? [];
  return {
    ...project,
    pages: pages.map((page) => page.id === pageId ? { ...page, blocks } : page),
    ...(project.activePageId === pageId ? { blocks } : {}),
  };
}

function normalizeCss(css: string): string {
  return serializeSafeBlockCss(css)
    .split(';')
    .filter(Boolean)
    .join(';');
}

export function applySiteMutations(initial: SiteProject, mutations: SiteMutation[]): SiteProject {
  let project = normalizeProjectPages(initial);
  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'UPDATE_NAVBAR':
        project = {
          ...project,
          settings: {
            ...getSiteSettings(project),
            navbar: { ...DEFAULT_NAVBAR_CONFIG, ...getSiteSettings(project).navbar, ...mutation.patch },
          },
        };
        break;
      case 'SET_GLOBAL_STYLE': {
        const allowed = ['liquidGlass', 'layoutMode', 'headerStyle', 'mode', 'palette', 'fonts', 'borderRadius', 'spacing', 'buttonStyle', 'borderStyle'];
        const patch = Object.fromEntries(Object.entries(mutation.patch).filter(([key]) => allowed.includes(key)));
        project = { ...project, theme: { ...project.theme, ...patch } };
        break;
      }
      case 'ADD_PAGE': {
        const page = { ...mutation.page, slug: mutation.page.slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'nouvelle-page' };
        if (!project.pages?.some((existing) => existing.slug === page.slug)) {
          project = { ...project, pages: [...(project.pages ?? []), page] };
        }
        break;
      }
      case 'ADD_BLOCK': {
        const page = pageFor(project, mutation.pageId);
        if (!page) break;
        const blocks = [...page.blocks];
        blocks.splice(Math.max(0, Math.min(blocks.length, mutation.index ?? blocks.length)), 0, mutation.block);
        project = replacePageBlocks(project, page.id, blocks);
        break;
      }
      case 'UPDATE_BLOCK': {
        const page = pageFor(project, mutation.pageId);
        if (!page) break;
        const blocks = page.blocks.map((block) =>
          block.id === mutation.blockId
            ? {
                ...block,
                ...mutation.patch,
                id: block.id,
                type: block.type,
                content: mutation.patch.content ? { ...block.content, ...mutation.patch.content } : block.content,
              }
            : block,
        );
        project = replacePageBlocks(project, page.id, blocks);
        break;
      }
      case 'DELETE_BLOCK': {
        const page = pageFor(project, mutation.pageId);
        if (page) project = replacePageBlocks(project, page.id, page.blocks.filter((block) => block.id !== mutation.blockId));
        break;
      }
      case 'APPLY_CUSTOM_CSS': {
        const css = normalizeCss(mutation.css);
        if (mutation.target === 'global') {
          project = { ...project, theme: { ...project.theme, customCss: css } };
        } else {
          const target = project.pages?.flatMap((page) => page.blocks).find((block) => block.id === mutation.target);
          if (target) {
            for (const page of project.pages ?? []) {
              if (page.blocks.some((block) => block.id === target.id)) {
                project = replacePageBlocks(project, page.id, page.blocks.map((block) => block.id === target.id
                  ? { ...block, styleOverride: { ...block.styleOverride, customCss: css } }
                  : block));
              }
            }
          }
        }
        break;
      }
    }
  }
  return normalizeProjectPages(project);
}
