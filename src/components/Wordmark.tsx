// A deliberately hooked capital J, shared by both name treatments.
export function Wordmark() {
  return <>
    <span className="sr-only">Jason Shaw</span>
    <span className="wordmark-visual" aria-hidden="true">
      <svg className="wordmark-j" viewBox="0 0 76 100" focusable="false">
        <path d="M17 3H73V61C73 86 60 99 36 99 12 99 0 85 0 63H20C20 75 25 81 36 81 48 81 53 74 53 61V21H17Z" fill="currentColor"/>
      </svg>
      <span className="wordmark-rest">ason <span className="wordmark-surname">shaw.</span></span>
    </span>
  </>
}
