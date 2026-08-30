import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';

export const REWRITE_MODEL = 'claude-opus-5';
export const MAX_TOKENS = 8000;
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export interface RewriteInput {
  title: string;
  body: string;
  sourceName: string;
  category: string;
}

export interface RewrittenArticle {
  title_vi: string;
  title_en: string;
  summary_vi: string;
  summary_en: string;
  body_vi: string;
  body_en: string;
  tags: string[];
  category: string;
}

export type RewriteResult =
  | { ok: true; article: RewrittenArticle }
  | { ok: false; reason: 'insufficient' | 'refusal' | 'error' };

const SYSTEM_PROMPT = `Bạn là biên tập viên viết lại tin quốc tế cho một trang tin song ngữ Việt - Anh.

Với thân bài gốc được cung cấp, viết một bản tin hoàn chỉnh bằng cả tiếng Việt và tiếng Anh.

Ràng buộc bắt buộc:
- Chỉ dùng dữ kiện có trong thân bài gốc được cung cấp.
- Không thêm số liệu, ngày tháng, tên riêng hay trích dẫn không có trong bài gốc.
- Không suy đoán nguyên nhân, hệ quả hay diễn biến tiếp theo.
- Không nêu ý kiến, không đứng về phía nào.
- Bản tiếng Việt phải là văn viết báo tự nhiên, không dịch từng chữ.
- Thân bài dài 3-5 đoạn; tóm tắt tối đa 2 câu; 3-6 thẻ tags viết thường.
- Nếu bài gốc không đủ dữ kiện để viết, đặt insufficient: true thay vì viết bừa.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    title_vi: { type: 'string' },
    title_en: { type: 'string' },
    summary_vi: { type: 'string' },
    summary_en: { type: 'string' },
    body_vi: { type: 'string' },
    body_en: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    insufficient: { type: 'boolean' },
  },
  required: [
    'title_vi',
    'title_en',
    'summary_vi',
    'summary_en',
    'body_vi',
    'body_en',
    'tags',
    'insufficient',
  ],
  additionalProperties: false,
} as const;

export function buildRewriteRequest(input: RewriteInput) {
  return {
    model: REWRITE_MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' as const },
    betas: [FALLBACK_BETA],
    fallbacks: 'default' as const,
    output_config: {
      effort: 'medium' as const,
      format: jsonSchemaOutputFormat(OUTPUT_SCHEMA, { transform: false }),
    },
    system: [
      {
        type: 'text' as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      {
        role: 'user' as const,
        content: `Nguồn: ${input.sourceName}\nTiêu đề gốc: ${input.title}\n\nThân bài gốc:\n${input.body}`,
      },
    ],
  };
}

export interface RewriteDeps {
  parse: (request: ReturnType<typeof buildRewriteRequest>) => Promise<{
    stop_reason: string | null;
    parsed_output?: unknown;
  }>;
}

export function createRewriteClient(apiKey = process.env['ANTHROPIC_API_KEY']): RewriteDeps {
  const client = new Anthropic({ apiKey, maxRetries: 4 });
  return {
    parse: (request) => client.beta.messages.parse(request as never) as never,
  };
}

export async function rewriteArticle(
  input: RewriteInput,
  deps: RewriteDeps,
): Promise<RewriteResult> {
  let message: Awaited<ReturnType<RewriteDeps['parse']>>;
  try {
    message = await deps.parse(buildRewriteRequest(input));
  } catch {
    return { ok: false, reason: 'error' };
  }

  // Kiểm tra stop_reason trước khi chạm vào content — spec Bước 4.
  if (message.stop_reason === 'refusal') return { ok: false, reason: 'refusal' };

  const output = message.parsed_output as
    | (Omit<RewrittenArticle, 'category'> & { insufficient: boolean })
    | undefined;
  if (!output) return { ok: false, reason: 'error' };
  if (output.insufficient) return { ok: false, reason: 'insufficient' };

  const { insufficient: _drop, ...article } = output;
  return { ok: true, article: { ...article, category: input.category } };
}
