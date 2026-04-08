const MAX_CONTENT_LENGTH = 300;

export function validatePostContent(content: string) {
  const trimmed = content.trim();

  if (trimmed.length < 1 || trimmed.length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      message: `내용은 1자 이상 ${MAX_CONTENT_LENGTH}자 이하로 입력해 주세요.`,
    };
  }

  return { valid: true, message: null };
}
