# Graph Report - C:\Users\pc\Desktop\Brahma_associates  (2026-06-21)

## Corpus Check
- 58 files · ~95,248 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 150 nodes · 118 edges · 43 communities detected
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 8 edges
2. `MainActivity` - 5 edges
3. `useColorScheme()` - 5 edges
4. `MainApplication` - 3 edges
5. `handleLogout()` - 3 edges
6. `triggerShake()` - 3 edges
7. `checkPin()` - 3 edges
8. `handlePinSubmit()` - 3 edges
9. `handleRefresh()` - 3 edges
10. `syncWithCloud()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `TransactionDetailScreen()` --calls--> `useTheme()`  [INFERRED]
  C:\Users\pc\Desktop\Brahma_associates\src\app\transactions\[id].tsx → C:\Users\pc\Desktop\Brahma_associates\src\hooks\use-theme.ts
- `TabLayout()` --calls--> `useColorScheme()`  [INFERRED]
  C:\Users\pc\Desktop\Brahma_associates\src\app\_layout.tsx → C:\Users\pc\Desktop\Brahma_associates\src\hooks\use-color-scheme.web.ts
- `CustomerDetailScreen()` --calls--> `useTheme()`  [INFERRED]
  C:\Users\pc\Desktop\Brahma_associates\src\app\customers\[id].tsx → C:\Users\pc\Desktop\Brahma_associates\src\hooks\use-theme.ts
- `StockDetailScreen()` --calls--> `useTheme()`  [INFERRED]
  C:\Users\pc\Desktop\Brahma_associates\src\app\stock\[id].tsx → C:\Users\pc\Desktop\Brahma_associates\src\hooks\use-theme.ts
- `CustomTabList()` --calls--> `useColorScheme()`  [INFERRED]
  C:\Users\pc\Desktop\Brahma_associates\src\components\app-tabs.web.tsx → C:\Users\pc\Desktop\Brahma_associates\src\hooks\use-color-scheme.web.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (6): CustomerDetailScreen(), StockDetailScreen(), Card(), ThemedText(), ThemedView(), useTheme()

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (2): getCustomerName(), handleRefresh()

### Community 2 - "Community 2"
Cohesion: 0.2
Nodes (4): CustomTabList(), TabLayout(), useColorScheme(), WebBadge()

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (5): AlertLogout(), handleLogout(), handleSync(), refreshData(), syncWithCloud()

### Community 4 - "Community 4"
Cohesion: 0.39
Nodes (5): checkPin(), handleCreateOwner(), handleKeyPress(), handlePinSubmit(), triggerShake()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (1): MainApplication

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (4): exportDatabaseBackup(), handleExport(), importDatabaseBackup(), triggerFilePicker()

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (0): 

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.67
Nodes (2): handlePickImage(), handleSave()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (1): TransactionDetailScreen()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (2): initializeDatabase(), seedInitialCatalog()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.67
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 1.0
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 1.0
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 18`** (2 nodes): `reset-project.js`, `moveDirectories()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 19`** (2 nodes): `index.ts`, `initializeDatabase()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 20`** (2 nodes): `_layout.tsx`, `CustomersLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (2 nodes): `_layout.tsx`, `StockLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (2 nodes): `_layout.tsx`, `TransactionsLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `hint-row.tsx`, `HintRow()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `symbol-view.tsx`, `SymbolView()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `crypto.ts`, `sha256()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `permissions.ts`, `hasPermission()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (1 nodes): `app-tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (1 nodes): `collapsible.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `theme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `schema.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `use-color-scheme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `useAuthStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `useCustomerStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `useSettingsStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `useStockStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `useTransactionStore.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (1 nodes): `css.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (1 nodes): `expo-symbols.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useTheme()` connect `Community 0` to `Community 2`, `Community 12`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `useColorScheme()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `useTheme()` (e.g. with `CustomerDetailScreen()` and `StockDetailScreen()`) actually correct?**
  _`useTheme()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `useColorScheme()` (e.g. with `TabLayout()` and `CustomTabList()`) actually correct?**
  _`useColorScheme()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._