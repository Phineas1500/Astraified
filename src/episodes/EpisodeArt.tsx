/** Original inventory props. Scene and bag use the same silhouette. */
export function EpisodeArt({
  icon,
  active = false,
}: {
  icon: string;
  active?: boolean;
}) {
  const paper = [
    "paper",
    "note",
    "record",
    "ticket",
    "map",
    "letter",
    "tape",
  ].includes(icon);
  const tool = ["magnet", "hook", "tool", "key", "thread", "cord"].includes(
    icon,
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="ep-prop-art">
      <ellipse cx="50" cy="87" rx="34" ry="6" fill="#172f3740" />
      <g
        stroke="#29444a"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {paper ? (
          <>
            <path d="M24 11H64L78 27V80Q51 73 24 82Z" fill="#f5e8bd" />
            <path
              d="M64 11V28H78M33 36H66M33 46H61M33 56H68"
              fill="none"
              stroke="#8b9d87"
            />
            <circle cx="58" cy="69" r="9" fill="#cf825f" />
            <path d="M54 69L57 72L63 65" fill="none" stroke="#ffe4af" />
          </>
        ) : icon === "comb" || icon === "rail" ? (
          <>
            <path
              d="M16 24H84V43H77V76H69V43H61V76H53V43H45V76H37V43H29V76H21V43H16Z"
              fill="#e2b965"
            />
            <path d="M24 31H76" stroke="#fff0b7" />
          </>
        ) : icon === "cartridge" ? (
          <>
            <rect x="20" y="17" width="60" height="67" rx="6" fill="#729d90" />
            <rect x="30" y="25" width="40" height="33" rx="3" fill="#e7d7a7" />
            <path d="M31 36H41V48H51V32H65" fill="none" stroke="#b57257" />
            <path
              d="M31 72V84M42 72V84M54 72V84M66 72V84"
              stroke="#edc87c"
              strokeWidth="5"
            />
          </>
        ) : icon === "shutter" || icon === "mask" ? (
          <>
            <rect x="15" y="18" width="70" height="65" rx="5" fill="#4e7f79" />
            {[0, 1, 2].map((row) =>
              [0, 1, 2].map((col) => (
                <rect
                  key={`${row}-${col}`}
                  x={23 + col * 19}
                  y={26 + row * 17}
                  width="14"
                  height="12"
                  rx="2"
                  fill={col <= row ? "#eac676" : "#263e49"}
                />
              )),
            )}
          </>
        ) : tool ? (
          <>
            <path
              d="M25 20V54A25 25 0 0 0 75 54V20H61V54A11 11 0 0 1 39 54V20Z"
              fill="#c77d60"
            />
            <path d="M25 20H39V34H25ZM61 20H75V34H61Z" fill="#bed2c4" />
            <path d="M20 12L15 6M48 13V4M80 12L86 6" stroke="#eacb79" />
          </>
        ) : icon === "keepsake" || icon === "gift" ? (
          <>
            <rect x="18" y="38" width="66" height="44" rx="6" fill="#dcad67" />
            <path d="M15 35H85V46H15Z" fill="#edcc8a" />
            <path
              d="M44 36V83H56V36M50 35C17 29 30 8 43 20L50 35C78 27 69 9 56 20Z"
              fill="#649790"
            />
          </>
        ) : (
          <>
            <path d="M16 36H84V81H16Z" fill="#63958b" />
            <rect x="22" y="18" width="55" height="48" rx="7" fill="#d3b66e" />
            <rect
              x="28"
              y="25"
              width="43"
              height="28"
              rx="3"
              fill={active ? "#e8e6a0" : "#263f49"}
            />
            <path
              d="M33 41H41L47 32L53 45L61 34H67"
              fill="none"
              stroke={active ? "#65976d" : "#9dbbaa"}
            />
            <circle cx="29" cy="74" r="5" fill="#df8864" />
            <circle
              cx="70"
              cy="74"
              r="5"
              fill={active ? "#d9de8b" : "#b3c4a7"}
            />
            <path d="M39 62H61V90H39Z" fill="#f6e8bb" />
            <path
              d="M43 70H57M43 77H57M43 84H53"
              stroke="#a5a881"
              strokeWidth="2"
            />
          </>
        )}
      </g>
    </svg>
  );
}
