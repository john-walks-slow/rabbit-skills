/**
 * data.ts — content.json 的类型化访问
 * 数据由 scripts/generate-content.mjs 于构建期从项目文件自动生成。
 */
import raw from './generated/content.json';

export type ItemType = 'readme' | 'skill' | 'agent' | 'instruction' | 'hook';

export interface ContentItem {
  id: string;
  type: ItemType;
  name: string;
  description: string;
  activation?: string;
  userInvocable?: boolean;
  mode?: string;
  events?: string[];
  path: string;
  url: string;
  lines: number;
  content: string;
  /** 核心工作流序号（1/2/3） */
  core?: number;
}

export interface ContentData {
  version: string;
  targets: string[];
  generatedAt: string;
  counts: Record<string, number>;
  totalLines: number;
  items: ContentItem[];
}

export const data = raw as unknown as ContentData;

export const TYPE_LABEL: Record<ItemType, string> = {
  readme: 'Readme',
  skill: 'Skill',
  agent: 'Agent',
  instruction: 'Instruction',
  hook: 'Hook',
};
