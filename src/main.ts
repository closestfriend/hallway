import { App } from './app/App';

const app = new App(document.getElementById('app')!);
app.start();

// fade the interaction hint after a while
setTimeout(() => {
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '0';
}, 14000);

// HMR / teardown hygiene
if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
