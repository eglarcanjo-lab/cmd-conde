export default function Background() {
  return (
    <div style={styles.wrapper} aria-hidden="true">
      <svg
        style={styles.svg}
        viewBox="0 0 800 500"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMaxYMax meet"
      >
        {/* Espiga 1 */}
        <g transform="translate(100,500) rotate(-8)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-220"/>
          <ellipse fill="currentColor" cx="-7" cy="-160" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="7"  cy="-155" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="-8" cy="-178" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="8"  cy="-173" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="-7" cy="-196" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="7"  cy="-191" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="0"  cy="-212" rx="5" ry="8"/>
          <path fill="currentColor" d="M0,-100 Q-30,-90 -45,-70 Q-20,-80 0,-100Z"/>
          <path fill="currentColor" d="M0,-130 Q28,-118 40,-95 Q18,-110 0,-130Z"/>
        </g>

        {/* Espiga 2 */}
        <g transform="translate(190,510) rotate(3)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-240"/>
          <ellipse fill="currentColor" cx="-7" cy="-175" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="7"  cy="-170" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="-8" cy="-194" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="8"  cy="-189" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="-7" cy="-213" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="7"  cy="-208" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="0"  cy="-228" rx="5" ry="9"/>
          <path fill="currentColor" d="M0,-110 Q35,-95 50,-72 Q22,-88 0,-110Z"/>
          <path fill="currentColor" d="M0,-145 Q-32,-130 -44,-105 Q-18,-122 0,-145Z"/>
        </g>

        {/* Cevada com barbas */}
        <g transform="translate(310,510) rotate(1)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-260"/>
          <g transform="translate(0,-180)">
            <ellipse fill="currentColor" cx="-5" cy="0"   rx="4" ry="8"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="-5" y1="-8"  x2="-14" y2="-35"/>
            <ellipse fill="currentColor" cx="5"  cy="5"   rx="4" ry="8"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="5"  y1="-3"  x2="14"  y2="-30"/>
            <ellipse fill="currentColor" cx="-5" cy="-18" rx="4" ry="8"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="-5" y1="-26" x2="-16" y2="-52"/>
            <ellipse fill="currentColor" cx="5"  cy="-13" rx="4" ry="8"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="5"  y1="-21" x2="16"  y2="-46"/>
            <ellipse fill="currentColor" cx="-4" cy="-36" rx="4" ry="7"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="-4" y1="-43" x2="-13" y2="-66"/>
            <ellipse fill="currentColor" cx="4"  cy="-31" rx="4" ry="7"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="4"  y1="-38" x2="13"  y2="-61"/>
            <ellipse fill="currentColor" cx="0"  cy="-50" rx="3" ry="6"/>
            <line stroke="currentColor" strokeWidth="0.8" fill="none" x1="0"  y1="-56" x2="0"   y2="-75"/>
          </g>
          <path fill="currentColor" d="M0,-120 Q38,-105 52,-80 Q24,-96 0,-120Z"/>
          <path fill="currentColor" d="M0,-155 Q-34,-140 -46,-112 Q-20,-130 0,-155Z"/>
        </g>

        {/* Espiga 3 */}
        <g transform="translate(430,500) rotate(-5)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-210"/>
          <ellipse fill="currentColor" cx="-6" cy="-155" rx="5" ry="10"/>
          <ellipse fill="currentColor" cx="6"  cy="-150" rx="5" ry="10"/>
          <ellipse fill="currentColor" cx="-7" cy="-172" rx="5" ry="10"/>
          <ellipse fill="currentColor" cx="7"  cy="-167" rx="5" ry="10"/>
          <ellipse fill="currentColor" cx="-6" cy="-189" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="6"  cy="-184" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="0"  cy="-202" rx="4" ry="7"/>
          <path fill="currentColor" d="M0,-95 Q-28,-82 -38,-62 Q-16,-75 0,-95Z"/>
        </g>

        {/* Espiga 4 */}
        <g transform="translate(540,505) rotate(6)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-230"/>
          <ellipse fill="currentColor" cx="-7" cy="-165" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="7"  cy="-160" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="-8" cy="-184" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="8"  cy="-179" rx="6" ry="11"/>
          <ellipse fill="currentColor" cx="-7" cy="-203" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="7"  cy="-198" rx="6" ry="10"/>
          <ellipse fill="currentColor" cx="0"  cy="-218" rx="5" ry="8"/>
          <path fill="currentColor" d="M0,-105 Q30,-92 42,-70 Q20,-84 0,-105Z"/>
          <path fill="currentColor" d="M0,-138 Q-28,-124 -40,-100 Q-16,-115 0,-138Z"/>
        </g>

        {/* Espiga 5 */}
        <g transform="translate(660,500) rotate(-3)" opacity="0.5">
          <line stroke="currentColor" strokeWidth="1.2" fill="none" x1="0" y1="0" x2="0" y2="-200"/>
          <ellipse fill="currentColor" cx="-6" cy="-148" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="6"  cy="-143" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="-6" cy="-165" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="6"  cy="-160" rx="5" ry="9"/>
          <ellipse fill="currentColor" cx="-5" cy="-182" rx="5" ry="8"/>
          <ellipse fill="currentColor" cx="5"  cy="-177" rx="5" ry="8"/>
          <ellipse fill="currentColor" cx="0"  cy="-193" rx="4" ry="7"/>
          <path fill="currentColor" d="M0,-88 Q26,-76 36,-56 Q16,-70 0,-88Z"/>
        </g>
      </svg>
    </div>
  );
}

const styles = {
  wrapper: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: "320px",
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
  },
  svg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    color: "var(--espiga-color)",
  },
};
