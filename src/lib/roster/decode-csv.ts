/**
 * 업로드된 CSV 바이트 → 문자열 (순수 함수).
 * 엑셀에서 "CSV(쉼표로 분리)"로 저장한 한글 파일은 UTF-8이 아니라 EUC-KR(CP949)인 경우가 많아,
 * UTF-8로 엄격하게 읽어 보고 실패하면 EUC-KR로 다시 읽는다.
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    // BOM은 TextDecoder가 기본으로 제거한다
    return new TextDecoder("utf-8", { fatal: true }).decode(view);
  } catch {
    return new TextDecoder("euc-kr").decode(view);
  }
}
