export function SceneProp({ id, lit = false, open = false }: { id: string; lit?: boolean; open?:boolean }) {
  if (id === "ferry") return null;
  if (id === "planks")
    return (
      <span className="adv-glint" aria-hidden="true">
        ✧
      </span>
    );
  return (
    <svg className="adv-scene-prop" viewBox="0 0 180 140" aria-hidden="true">
      <g
        stroke="#2c4647"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {id === "teapot" && (
          <>
            <ellipse
              cx="85"
              cy="125"
              rx="50"
              ry="7"
              fill="#153b4325"
              stroke="none"
            />
            <path
              d="M120 62C163 30 168 104 123 95"
              fill="none"
              stroke="#e3c795"
              strokeWidth="12"
            />
            <path d="M52 76L17 46L25 83L52 104" fill="#ddae74" />
            <path d="M55 56Q25 114 72 121H108Q151 105 119 57Z" fill="#e8c693" />
            <path d="M53 58Q82 39 120 58Z" fill="#819f8b" />
            <circle cx="87" cy="44" r="7" fill="#728e7c" />
            <path
              d="M68 92Q87 106 111 90M77 82V87M103 79V84"
              fill="none"
              stroke="#597c70"
            />
          </>
        )}
        {id === "workbench" && (
          <>
            <path d="M16 86H165L157 104H24Z" fill="#b88759" />
            <path
              d="M27 103L23 137M151 104L157 137"
              strokeWidth="12"
              stroke="#7b644c"
            />
            <rect x="31" y="31" width="103" height="57" rx="8" fill="#5c8b81" />
            <rect x="44" y="43" width="77" height="31" rx="4" fill="#dfca93" />
            <path d="M54 61H72M87 61H109" stroke="#a27650" strokeWidth="5" />
            <circle cx="78" cy="60" r="7" fill="#a9c4ad" />
            <path d="M145 55V85M140 53H151" stroke="#d4b366" strokeWidth="6" />
          </>
        )}
        {id === "cubby" && (
          <>
            <path d="M24 12H155V129H24Z" fill="#886f51" />
            <path d="M32 23H146V117H32Z" fill="#344d48" />
            <path
              d="M31 57H147M31 90H148M87 22V117"
              stroke="#bc9562"
              strokeWidth="7"
            />
            <path d="M41 35H73V47H41M98 103H127V114H98" fill="#e7d6ae" />
            <path d="M113 59L142 70L133 87L105 75Z" fill="#d0bb8c" />
            <path d="M106 71L129 77" stroke="#907e5a" strokeWidth="2" />
            <text
              x="56"
              y="44"
              textAnchor="middle"
              fontFamily="sans-serif"
              fontSize="9"
              stroke="none"
              fill="#46554a"
            >
              B-12
            </text>
          </>
        )}
        {id === "recess" && (
          <>
            <path d="M20 10H164V135H20Z" fill="#486762" />
            <path d="M30 20H152V124H30Z" fill={lit ? "#a7976c" : "#193b3e"} />
            <path
              d="M47 123V38H82V64H114V95H142V123H47"
              fill="none"
              stroke={lit ? "#e4b675" : "#2a5250"}
              strokeWidth="6"
            />
            {lit && (
              <>
                <circle cx="82" cy="48" r="10" fill="#e9d397" />
                <circle cx="115" cy="81" r="10" fill="#e9d397" />
                <path d="M38 94H56M41 102H53" stroke="#efe1ac" strokeWidth="3"/>
              </>
            )}
            <path d="M16 9L2 29V122L17 135" fill="#8ba99a" />
            <circle cx="23" cy="72" r="3" fill="#d8b772" />
          </>
        )}
        {(id === "panel" || id === "feeder") && (
          <>
            <rect
              x="13"
              y="8"
              width="152"
              height="121"
              rx="13"
              fill="#57837a"
            />
            <rect x="25" y="21" width="128" height="85" rx="7" fill="#d6c58f" />
            <circle cx="59" cy="47" r="16" fill={lit ? "#f2bb70" : "#ac7860"} />
            <circle
              cx="119"
              cy="47"
              r="16"
              fill={lit ? "#d4e6a9" : "#759785"}
            />
            <path d="M45 79H71M105 79H132" stroke="#5e7867" strokeWidth="6" />
            <circle cx="57" cy="82" r="5" fill="#dac37c" />
            <circle cx="118" cy="82" r="5" fill="#dac37c" />
            <path d="M73 116H105" stroke="#254e4d" strokeWidth="5" />
            {id === "feeder" && (
              <path d="M87 58L78 71H91L84 87" fill="#bb835c" stroke="none" />
            )}
            {id === 'panel' && <g className="adv-panel-door" style={{transformOrigin:'13px 70px',transform:open?'translate(-8px, 0) scaleX(.12)':'none'}}>
              <rect x="13" y="8" width="152" height="121" rx="13" fill="#739383"/>
              <rect x="22" y="17" width="134" height="102" rx="10" fill="none" stroke="#acba94"/>
              <circle cx="115" cy="73" r="20" fill="#b69b63"/>
              <path d="M115 56V91M98 73H132" stroke="#465e51" strokeWidth="5"/>
              <circle cx="115" cy="73" r="6" fill="#dbc785"/>
            </g>}
          </>
        )}
        {id === "window" && (
          <>
            <path d="M24 130V29Q90-5 154 30V130Z" fill="#304f51" />
            <path d="M34 122V37Q91 8 144 37V122Z" fill="#729fa0" />
            <path d="M89 20V125M34 71H144" stroke="#c9b580" strokeWidth="6" />
            <path
              d="M39 109Q64 88 86 108Q112 86 142 108V119H38Z"
              fill="#517f7c"
            />
            <circle cx="61" cy="96" r="7" fill={lit ? "#f7cc76" : "#9a695d"} />
            <circle cx="117" cy="96" r="7" fill={lit ? "#cde4a1" : "#5e8070"} />
          </>
        )}
      </g>
    </svg>
  );
}
