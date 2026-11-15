/**
 * 첫 렌더 전에 data-theme 를 결정해 플래시를 막는 인라인 스크립트.
 * localStorage "daily:theme" = "light" | "dark" | "system"
 */
export function ThemeScript() {
  const code = `(function(){try{var k='daily:theme';var s=localStorage.getItem(k)||'system';var m=window.matchMedia('(prefers-color-scheme: dark)');var apply=function(){var v=localStorage.getItem(k)||'system';var t=v==='system'?(m.matches?'dark':'light'):v;document.documentElement.setAttribute('data-theme',t);};apply();m.addEventListener('change',apply);window.addEventListener('storage',function(e){if(e.key===k)apply();});}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
