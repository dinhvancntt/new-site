/** Thân bài lưu dạng văn xuôi 3-5 đoạn; model có thể ngắt bằng một hoặc hai xuống dòng. */
export function toParagraphs(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
