import type { ItemId } from "./model";

export function ItemArt({ item }: { item: ItemId }) {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true" className="adv-item-art">
      <g
        stroke="#29454a"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {item === "tester" && (
          <>
            <path
              d="M25 48C8 45 9 18 18 18M54 47C75 53 73 14 65 15"
              fill="none"
              stroke="#bb765b"
            />
            <rect x="22" y="20" width="35" height="49" rx="8" fill="#d6ac58" />
            <rect x="29" y="28" width="21" height="15" rx="3" fill="#d1dec0" />
            <path d="M34 39L40 32L45 37" fill="none" />
            <circle cx="40" cy="54" r="7" fill="#426761" />
            <path d="M16 18V9M65 15V7" strokeWidth="4" />
          </>
        )}
        {(item === "bulb" || item === "broken-bulb") && (
          <>
            <path
              d="M28 49C7 25 22 11 39 10C64 8 71 32 52 48L49 61H31Z"
              fill={item === "bulb" ? "#fbe4a0" : "#a6beb9"}
            />
            <path
              d="M32 61H49V70H32ZM33 48L37 33L41 39L45 32L48 48"
              fill="none"
            />
            {item === "broken-bulb" && (
              <path d="M44 12L33 27L47 31L37 42" stroke="#718f89" />
            )}
          </>
        )}
        {item === "cell" && (
          <>
            <rect x="23" y="15" width="35" height="54" rx="7" fill="#6a9c8c" />
            <path d="M33 15V8H49V15M24 32H57" fill="#d9b65c" />
            <path d="M33 45H47M40 38V52" stroke="#f8e6b5" strokeWidth="4" />
          </>
        )}
        {(item === "casing" || item === "lamp") && (
          <>
            <path d="M28 18V12Q40 3 53 12V19" fill="none" strokeWidth="5" />
            <path
              d="M23 22H56L64 61H16Z"
              fill={item === "lamp" ? "#e1b355" : "#6e9990"}
            />
            <path
              d="M28 29H50L55 56H23Z"
              fill={item === "lamp" ? "#fff2b7" : "#bed4c8"}
            />
            <path d="M18 61H62V68H18Z" fill="#385e5a" />
            {item === "lamp" && (
              <path d="M39 48L37 37L44 42" fill="none" stroke="#d2a04b" />
            )}
          </>
        )}
        {item === "hook" && (
          <>
            <path
              d="M46 10V47C46 68 16 66 19 47L26 39"
              fill="none"
              stroke="#9eb7ad"
              strokeWidth="8"
            />
            <circle cx="46" cy="12" r="7" fill="#d5ddd0" />
          </>
        )}
        {(item === "reel" || item === "retriever") && (
          <>
            <circle cx="34" cy="36" r="24" fill="#d6b26a" />
            <circle cx="34" cy="36" r="16" fill="none" stroke="#8d7753" />
            <circle cx="34" cy="36" r="7" fill="#718f83" />
            <path
              d="M53 30Q74 35 60 59L46 66"
              fill="none"
              stroke="#a18b5f"
              strokeWidth="5"
            />
            {item === "retriever" && (
              <path
                d="M46 64C46 80 26 78 29 62"
                fill="none"
                stroke="#94b5ad"
                strokeWidth="6"
              />
            )}
          </>
        )}
        {item === "photo" && (
          <>
            <path d="M13 15L66 11L70 64L17 69Z" fill="#fff0ca" />
            <path d="M20 22L59 19L62 54L22 58Z" fill="#9abab5" />
            <path d="M25 49L30 35L41 38L47 27L57 47" fill="#567e77" />
            <path d="M45 33V24H52V44" fill="#ecd5a1" />
          </>
        )}
        {item === "record" && (
          <>
            <path d="M17 10H56L65 20V69H17Z" fill="#e6ce93" />
            <path
              d="M55 10V22H65M27 32H54M27 40H51M27 48H40"
              fill="none"
              stroke="#8a8262"
            />
            <circle cx="48" cy="55" r="9" fill="none" stroke="#ba7961" />
            <path d="M43 55L47 59L54 50" stroke="#ba7961" fill="none" />
          </>
        )}
        {item === "lead" && (
          <>
            <path
              d="M22 24C1 41 40 80 57 57C75 32 28 44 46 21"
              fill="none"
              stroke="#c8765d"
              strokeWidth="7"
            />
            <path
              d="M16 18L26 27M42 16L51 25"
              stroke="#cfbf8b"
              strokeWidth="9"
            />
            <path d="M14 16L9 11M42 15L36 9" stroke="#6e9190" strokeWidth="5" />
          </>
        )}
        {item === "keepsake" && (
          <>
            <path
              d="M27 24Q7 40 23 57Q36 72 48 53L58 32"
              fill="none"
              stroke="#bc9860"
              strokeWidth="3"
            />
            <path d="M29 31L51 21L65 56L41 68Z" fill="#d3ad58" />
            <ellipse cx="46" cy="47" rx="10" ry="13" fill="#e8d397" />
            <path d="M44 42L51 45L45 52" fill="none" />
          </>
        )}
        {item === "memento" && (
          <>
            <path d="M12 31L40 17L68 30L40 47Z" fill="#e0c481" />
            <path d="M12 31V58L40 73V47M40 73L68 57V30" fill="#8fada0" />
            <path d="M23 30L40 23L58 31L40 40Z" fill="#f6e9bd" />
            <path d="M32 61L43 55L49 60L41 66Z" fill="#d1ad61" />
          </>
        )}
      </g>
    </svg>
  );
}
