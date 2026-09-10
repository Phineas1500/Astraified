import type { CSSProperties } from "react";

const ink = "#243f45";

/** Original vector puppets, kept separate from the illustrated rooms. */
export function Character({
  id,
  talking = false,
}: {
  id: string;
  talking?: boolean;
}) {
  if (id === "button")
    return (
      <svg
        className="adv-character adv-crab"
        viewBox="0 0 180 110"
        aria-hidden="true"
      >
        <g
          stroke={ink}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse
            cx="90"
            cy="96"
            rx="53"
            ry="7"
            fill="#173a4230"
            stroke="none"
          />
          <g fill="none" stroke="#bd634e">
            <path d="M55 73L28 80L18 92M60 82L37 95M125 73L151 80L162 92M120 82L143 95" />
          </g>
          <path
            d="M48 69L32 52M132 69L149 48"
            fill="none"
            stroke="#d98463"
            strokeWidth="9"
          />
          <path
            d="M33 53C2 56 4 24 20 24L24 39L36 22C49 31 48 47 33 53Z"
            fill="#eeaa7b"
          />
          <path
            d="M149 49C132 36 135 17 148 15L150 31L164 18C180 33 171 55 149 49Z"
            fill="#eeaa7b"
          />
          <ellipse cx="90" cy="71" rx="43" ry="28" fill="#d98463" />
          <path
            d="M74 49L73 32M105 49L108 32"
            fill="none"
            stroke="#d98463"
            strokeWidth="9"
          />
          <g className="adv-eyes">
            <ellipse cx="73" cy="30" rx="9" ry="13" fill="#fff5da" />
            <ellipse cx="109" cy="30" rx="9" ry="13" fill="#fff5da" />
            <circle cx="75" cy="30" r="3" fill={ink} />
            <circle cx="107" cy="30" r="3" fill={ink} />
          </g>
          <path d="M80 75Q90 84 101 75" fill="none" />
          <circle cx="113" cy="77" r="5" fill="#f3b795" stroke="none" />
          <path
            d="M61 61Q90 45 120 61"
            fill="none"
            stroke="#f5bc8f"
            strokeWidth="3"
          />
        </g>
      </svg>
    );
  if (id === "tock")
    return (
      <svg
        className={`adv-character ${talking ? "is-talking" : ""}`}
        viewBox="0 0 180 240"
        aria-hidden="true"
      >
        <g
          stroke={ink}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse
            cx="90"
            cy="231"
            rx="57"
            ry="8"
            fill="#173a4228"
            stroke="none"
          />
          <path
            d="M57 185L55 220H76L80 185M104 185L110 221H134L125 181"
            fill="#507c78"
          />
          <path
            d="M42 119L24 151L28 173M140 119L158 151L149 169"
            fill="none"
            stroke="#d1ad60"
            strokeWidth="13"
          />
          <path
            d="M19 166L15 181L29 187L39 176M139 166L137 181L150 185L159 173"
            fill="#709a91"
          />
          <rect x="41" y="104" width="101" height="87" rx="22" fill="#6c9a8c" />
          <rect x="57" y="119" width="70" height="51" rx="9" fill="#d8c991" />
          <circle cx="92" cy="144" r="15" fill="#f7e5ac" />
          <path d="M92 144L100 135" />
          <circle cx="64" cy="181" r="3" fill={ink} />
          <circle cx="120" cy="181" r="3" fill={ink} />
          <path d="M81 105V90H103V105" fill="#c8ad68" />
          <rect x="33" y="31" width="113" height="68" rx="23" fill="#d4ab5d" />
          <path d="M44 46H134V82H44Z" fill="#264a4b" />
          <g className="adv-eyes" fill="#f7e6a6" stroke="none">
            <rect x="60" y="55" width="14" height="17" rx="5" />
            <rect x="105" y="55" width="14" height="17" rx="5" />
          </g>
          <path d="M86 80H98" stroke="#f7e6a6" strokeWidth="3" />
          <path d="M90 30V13L104 7" fill="none" />
          <circle cx="106" cy="7" r="5" fill="#e79a70" />
          <path d="M36 47H25V76H33M146 47H156V76H147" fill="#719a8b" />
          <path d="M44 224H80M105 224H140" strokeWidth="10" />
        </g>
      </svg>
    );
  if (id === "pip")
    return (
      <svg
        className={`adv-character ${talking ? "is-talking" : ""}`}
        viewBox="0 0 180 240"
        aria-hidden="true"
      >
        <g
          stroke={ink}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse
            cx="90"
            cy="231"
            rx="58"
            ry="8"
            fill="#173a4228"
            stroke="none"
          />
          <path
            d="M68 212L47 228H82L89 210M108 211L103 228H139L122 211"
            fill="#df9f58"
          />
          <ellipse cx="91" cy="158" rx="60" ry="65" fill="#304955" />
          <path
            d="M69 115C46 137 43 183 60 207Q91 226 120 207C137 174 130 141 113 116"
            fill="#f5eace"
          />
          <path
            d="M38 129Q19 156 26 181Q45 181 54 153M139 128Q161 147 153 178L132 155"
            fill="#304955"
          />
          <path d="M62 137L61 204Q91 220 122 204L120 137Z" fill="#729c91" />
          <path
            d="M78 138L75 118M105 138L109 119"
            fill="none"
            stroke="#729c91"
            strokeWidth="8"
          />
          <path d="M79 166H107V184Q93 194 79 184Z" fill="#e1dbb2" />
          <path d="M92 167V185" stroke="#7b9d89" strokeWidth="2" />
          <ellipse cx="90" cy="77" rx="53" ry="51" fill="#304955" />
          <path
            d="M84 45C49 33 31 65 47 88Q63 111 88 89Q113 110 136 86C147 57 115 31 94 44"
            fill="#fcf0d5"
          />
          <g className="adv-eyes" fill={ink}>
            <ellipse cx="69" cy="70" rx="4" ry="7" />
            <ellipse cx="111" cy="70" rx="4" ry="7" />
          </g>
          <path d="M85 81L110 87L91 103L74 91Z" fill="#e5a34e" />
          <path d="M85 82L90 96" stroke="#bf734b" strokeWidth="2" />
          <path
            d="M52 111Q90 126 127 109L131 124Q90 141 49 124Z"
            fill="#c67563"
          />
          <path d="M105 129L111 154L126 149L119 125" fill="#c67563" />
          <path d="M58 31Q71 11 87 28Q104 10 119 35" fill="#fff0d0" />
        </g>
      </svg>
    );
  const fox = id === "ada";
  return (
    <svg
      className={`adv-character ${talking ? "is-talking" : ""}`}
      viewBox="0 0 180 240"
      aria-hidden="true"
      style={{ "--fur": fox ? "#c77c4e" : "#9a7962" } as CSSProperties}
    >
      <g
        stroke={ink}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse
          cx="90"
          cy="232"
          rx="58"
          ry="8"
          fill="#173a4228"
          stroke="none"
        />
        {fox && (
          <path
            d="M121 170Q177 167 164 120Q151 126 136 142L112 185"
            fill="#ca8255"
          />
        )}
        <path
          d="M63 196L54 225H82L90 191M104 193L104 225H135L124 190"
          fill={fox ? "#596e67" : "#435c65"}
        />
        <path
          d="M54 113C39 133 36 176 51 198Q92 214 133 196C144 165 143 137 126 113"
          fill={fox ? "#769b83" : "#e5b95a"}
        />
        <path
          d="M48 130L27 166L36 180L62 153M133 126L153 159L146 176L123 151"
          fill={fox ? "#b27855" : "#e5b95a"}
        />
        <ellipse cx="32" cy="179" rx="11" ry="13" fill="var(--fur)" />
        <ellipse cx="147" cy="177" rx="11" ry="13" fill="var(--fur)" />
        {fox ? (
          <>
            <path
              d="M62 116L68 154H116L121 114"
              fill="none"
              stroke="#365852"
              strokeWidth="8"
            />
            <path d="M73 164H108V185H73Z" fill="#44695f" />
            <path d="M98 167L104 149" stroke="#c7c9b0" strokeWidth="6" />
          </>
        ) : (
          <>
            <path d="M90 128V201" stroke="#b88841" strokeWidth="3" />
            <path d="M61 144H76V158H61M106 144H123V158H106" fill="#f1cd75" />
            <circle cx="93" cy="146" r="2" fill={ink} />
            <circle cx="93" cy="172" r="2" fill={ink} />
          </>
        )}
        {fox ? (
          <path
            d="M43 65L34 14L71 36Q93 27 117 38L146 14L140 68Q159 99 124 114L91 130L59 113Q27 96 43 65Z"
            fill="var(--fur)"
          />
        ) : (
          <>
            <circle cx="45" cy="52" r="17" fill="var(--fur)" />
            <circle cx="134" cy="52" r="17" fill="var(--fur)" />
            <ellipse cx="90" cy="80" rx="54" ry="49" fill="var(--fur)" />
          </>
        )}
        <path
          d={
            fox
              ? "M44 73Q63 69 89 100Q114 72 141 76Q143 105 93 128Q48 112 44 73Z"
              : "M51 87Q68 71 90 91Q115 72 133 87Q139 119 94 126Q48 119 51 87Z"
          }
          fill="#eed7b2"
        />
        <g className="adv-eyes" fill={ink}>
          <ellipse cx="66" cy="74" rx="4" ry="6" />
          <ellipse cx="113" cy="74" rx="4" ry="6" />
        </g>
        <path d="M81 98Q89 93 99 98L90 106Z" fill={ink} />
        <path
          d="M90 107V113M90 112Q82 118 76 112M90 112Q99 118 105 111"
          fill="none"
          strokeWidth="2.5"
        />
        {fox ? (
          <>
            <path
              d="M46 44Q91 18 132 47"
              fill="none"
              stroke="#48675f"
              strokeWidth="9"
            />
            <circle cx="71" cy="40" r="13" fill="#b5cab8" />
            <circle cx="104" cy="40" r="13" fill="#b5cab8" />
            <path d="M85 40H89" />
          </>
        ) : (
          <>
            <path
              d="M42 44Q39 21 84 20Q124 17 139 43L136 55Q88 40 43 57Z"
              fill="#254955"
            />
            <path d="M43 47Q88 35 138 47L134 59Q89 49 43 61Z" fill="#d8b25f" />
            <path
              d="M85 27V40M78 33H92M79 35Q85 43 93 35"
              fill="none"
              stroke="#dfbf77"
              strokeWidth="2.5"
            />
            <path
              d="M65 88L46 84M64 96L43 99M115 88L139 84M116 96L138 101"
              strokeWidth="2"
            />
          </>
        )}
        <path d="M48 227H84M103 227H142" strokeWidth="8" />
      </g>
    </svg>
  );
}
