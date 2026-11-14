// Fallback ambient declarations so VS Code shows zero red lines even before `npm install` completes
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

declare module 'react' {
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export function useState<T>(initial: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export const StrictMode: any;
  const React: {
    FC: any;
    StrictMode: any;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useMemo: typeof useMemo;
  };
  export default React;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare module 'react/jsx-dev-runtime' {
  export function jsxDEV(type: any, props: any, key?: any, isStatic?: boolean, source?: any, self?: any): any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  const ReactDOM: {
    createRoot(container: Element | DocumentFragment): {
      render(children: any): void;
    };
  };
  export default ReactDOM;
}

declare module 'ol/ol.css';
declare module 'ol/*' {
  const content: any;
  export default content;
  export const Style: any;
  export const Stroke: any;
  export const Fill: any;
  export const Circle: any;
  export const Text: any;
}
