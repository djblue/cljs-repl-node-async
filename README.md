# cljs-repl-node-async

A clojurescript node repl-env that waits for promises to either resolve or
reject before returning a value.

## Before

```bash
% echo '(js/Promise.resolve 1)' | clojure -m cljs.main -re node
ClojureScript 1.10.520
cljs.user=> #object[Promise [object Promise]]
```

## After

```bash
% echo '(js/Promise.resolve 1)' | clojure -m cljs.main -re node-async
ClojureScript 1.10.520
cljs.user=> #object[Promise 1]
```

