// datetime-local 입력값 <-> ISO 변환 (브라우저 시간대와 무관하게 한국 시간 기준)

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const LOCAL_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** ISO 문자열 → KST 기준 `YYYY-MM-DDTHH:mm` (잘못된 값이면 빈 문자열) */
export function isoToKstLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  // KST 시각을 UTC 필드로 읽기 위해 9시간을 더한 뒤 앞 16자리만 사용
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** KST 기준 `YYYY-MM-DDTHH:mm` → ISO 문자열 (형식 오류·존재하지 않는 날짜면 null) */
export function kstLocalInputToIso(value: string | null | undefined): string | null {
  const m = LOCAL_INPUT_RE.exec((value ?? "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(utcMs);
  // 2월 30일처럼 넘침이 생기면 거부
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return null;
  }
  return new Date(utcMs - KST_OFFSET_MS).toISOString();
}
