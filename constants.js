// --- Icon Wrapper for Lucide (CDN vanilla → React components) ---
// Uses React.createElement directly (no JSX) so this can run as a regular <script>
function createLucideIcon() {
  var names = Array.prototype.slice.call(arguments);
  return function LucideIconComponent(props) {
    var size = props.size || 24;
    var className = props.className || '';
    var ref = React.useRef(null);
    React.useEffect(function () {
      if (ref.current) {
        ref.current.innerHTML = '';
        var icon = null;
        for (var i = 0; i < names.length; i++) {
          if (lucide.icons[names[i]]) { icon = lucide.icons[names[i]]; break; }
        }
        if (icon) {
          var svg = lucide.createElement(icon);
          svg.setAttribute('width', String(size));
          svg.setAttribute('height', String(size));
          if (className) svg.setAttribute('class', className);
          ref.current.appendChild(svg);
        }
      }
    }, [size, className]);
    return React.createElement('span', { ref: ref, style: { display: 'inline-flex', alignItems: 'center' } });
  };
}

window.Settings = createLucideIcon('settings');
window.Download = createLucideIcon('download');
window.FileText = createLucideIcon('file-text');
window.Plus = createLucideIcon('plus');
window.Trash2 = createLucideIcon('trash-2');
window.ImageIcon = createLucideIcon('image');
window.MessageSquare = createLucideIcon('message-square');
window.AlertTriangle = createLucideIcon('triangle-alert', 'alert-triangle');
window.Loader2 = createLucideIcon('loader-circle', 'loader-2');
window.Sparkles = createLucideIcon('sparkles');
window.Upload = createLucideIcon('upload');
window.FileSpreadsheet = createLucideIcon('file-spreadsheet');
window.RefreshCcw = createLucideIcon('refresh-ccw');
window.Code = createLucideIcon('code');
window.Trophy = createLucideIcon('trophy');
window.UserIcon = createLucideIcon('user');
window.FolderInput = createLucideIcon('folder-input');
window.Eye = createLucideIcon('eye');
window.EyeOff = createLucideIcon('eye-off');
window.X = createLucideIcon('x');
window.Share2 = createLucideIcon('share-2');
window.LinkIcon = createLucideIcon('link');

// --- Default Prompts ---
window.DEFAULT_UX_EXPERT_PROMPT = "\n##\u89D2\u8272\uFF08Role\uFF09\n\u4F60\u662F\u4E00\u4F4DUI\u3001UX\u9818\u57DF\u7684\u5C08\u5BB6\uFF0C\u719F\u8B80\u5C3C\u723E\u68EE\u5341\u5927\u539F\u7406\uFF0C\u7DB2\u9801\u7A0B\u5F0F\u6846\u67B6\uFF0C\u85DD\u8853\u7F8E\u5B78\u914D\u8272\uFF0C\u5305\u542B\u884C\u70BA\u5FC3\u7406\u5B78\u3001\u6D88\u8CBB\u5FC3\u7406\u5B78\u7B49\u77E5\u8B58\u3002\n\u8ACB\u4EE5UI/UX\u7684\u6A19\u6E96\u9032\u884C\u5206\u6790\u8207\u5EFA\u8B70\u3002\n\n##\u4EFB\u52D9\uFF08Task\uFF09\n\u91DD\u5C0D\u904A\u6232\u696D\u754C\u7522\u54C1\u9032\u884C\u5716\u7247\u5206\u6790\u3002\n\n##\u8F38\u51FA\u683C\u5F0F\uFF08Output Requirement\uFF09\n**\u8ACB\u52D9\u5FC5\u4EE5 JSON \u683C\u5F0F\u56DE\u50B3**\uFF0CJSON \u7269\u4EF6\u9700\u5305\u542B\uFF1A\n1. \"observation\": \u5B57\u4E32\u9663\u5217 (Array of Strings)\uFF0C3-5 \u9EDE\u5177\u9AD4\u89C0\u5BDF\u3002\n2. \"suggestion\": \u5B57\u4E32\u9663\u5217 (Array of Strings)\uFF0C3-5 \u9EDE\u5177\u9AD4\u5EFA\u8B70\u3002\n";

window.DEFAULT_DATA_IMPORT_PROMPT = "## \u89D2\u8272\n\u4F60\u662F\u4E00\u4F4D\u5177\u5099\u4F7F\u7528\u8005\u9AD4\u9A57\u5206\u6790\u8207\u8CC7\u8A0A\u7D71\u6574\u80FD\u529B\u7684\u5C08\u696D\u5206\u6790\u52A9\u624B\uFF0C\u64C5\u9577\u5F9E\u975E\u7D50\u69CB\u5316\u7684\u73A9\u5BB6\u9AD4\u9A57\u56DE\u994B\u4E2D\u63D0\u7149\u91CD\u9EDE\u3002\n\n## \u4EFB\u52D9\u76EE\u6A19\n\u5206\u6790\u63D0\u4F9B\u7684 Excel Raw Data (JSON Array)\uFF0C\u5C07\u76F8\u4F3C\u56DE\u994B\u6B78\u7D0D\u70BA Issues\uFF0C\u4E26\u627E\u51FA\u6BCF\u500B Issue \u7684\u6700\u4F73\u5EFA\u8B70\u8005\u3002\n\n## \u6838\u5FC3\u898F\u5247\uFF1A\u7CBE\u6E96 ID \u6620\u5C04 (Row-Level Mapping) - \u81F3\u95DC\u91CD\u8981\uFF01\n\u8ACB\u5C07\u8F38\u5165\u9663\u5217\u4E2D\u7684\u6BCF\u4E00\u7B46\u8CC7\u6599\u8996\u70BA\u4E00\u500B\u4E0D\u53EF\u5206\u5272\u7684\u7269\u4EF6\uFF1A`{ \"_id\", \"user\", \"account\", \"uxContext\", \"suggestion\" }`\u3002\n\u70BA\u4E86\u4FDD\u8B49\u8CC7\u6599 100% \u6B63\u78BA\uFF0C**\u56B4\u7981\u4F60\u81EA\u5DF1\u8F38\u51FA\u4EBA\u540D\u6216\u5E33\u865F**\uFF0C\u6240\u6709\u7684\u5C0D\u61C9\u90FD\u5FC5\u9808\u4F7F\u7528 `_id` \u9032\u884C\u95DC\u806F\u3002\n\n1. **Issue \u6B78\u7D0D\u898F\u5247 (Many-to-Many Mapping)**\uFF1A\n   - \u5C07\u591A\u7B46\u8CC7\u6599\u6B78\u7D0D\u70BA\u540C\u4E00\u500B Issue \u6642\uFF0C`relatedRowIds` \u9663\u5217**\u5FC5\u9808\u5305\u542B**\u9019\u4E9B\u8CC7\u6599\u7684 `_id`\u3002\n   - \u4F8B\u5982\uFF1A\u82E5 `_id: \"R1\"` \u548C `_id: \"R5\"` \u53CD\u6620\u4E86\u540C\u4E00\u500B\u554F\u984C\uFF0C\u5247 `relatedRowIds: [\"R1\", \"R5\"]`\u3002\n\n2. **\u8CC7\u6599\u4F86\u6E90\u56B4\u683C\u5340\u9694 (Strict Source Separation) - \u6975\u7AEF\u56B4\u683C**\uFF1A\n   - **\u55AE\u5411\u9694\u96E2\u539F\u5247**\uFF1A\u5728\u751F\u6210 `issue` (\u554F\u984C\u7E3D\u7D50) \u6642\uFF0C**\u50C5\u80FD\u8B80\u53D6** `uxContext` \u6B04\u4F4D\u3002\n   - **\u56B4\u7981\u8DE8\u6B04\u4F4D\u63A8\u8AD6**\uFF1A\u56B4\u7981\u8B80\u53D6 `suggestion` \u5167\u5BB9\u4F86\u53CD\u63A8 Issue\u3002\u5373\u4F7F `suggestion` \u6697\u793A\u4E86\u554F\u984C\uFF0C\u53EA\u8981 `uxContext` \u662F\u7A7A\u7684\u6216\u672A\u63D0\u53CA\u8A72\u554F\u984C\uFF0C\u8A72 `_id` \u5C31**\u7D55\u5C0D\u4E0D\u80FD**\u653E\u5165\u8A72 Issue \u7684 `relatedRowIds`\u3002\n\n3. **\u6700\u4F73\u5EFA\u8B70\u898F\u5247 (Semantic Extraction & ID Locking)**\uFF1A\n   - \u7576\u5224\u5B9A\u67D0\u500B Issue \u7684\u6700\u4F73\u5EFA\u8B70\u4F86\u81EA\u7279\u5B9A\u4E00\u7B46\u8CC7\u6599\u6642\uFF0C\u8ACB\u5C07\u8A72\u7B46\u8CC7\u6599\u7684 `_id` \u586B\u5165 `bestSuggesterRowId`\u3002\n   - **\u4F86\u6E90\u9396\u5B9A**\uFF1A`bestSuggesterRowId` \u5FC5\u9808\u662F `relatedRowIds` \u9663\u5217\u4E2D\u7684\u5176\u4E2D\u4E00\u500B `_id`\u3002\n   - **\u7CBE\u6E96\u63D0\u53D6 (Semantic Extraction - \u4FDD\u7559\u539F\u59CB\u524D\u7DB4)**\uFF1A\n     - \u5206\u6790\u7576\u524D Issue \u7684\u4E3B\u984C\uFF0C\u4E26\u5F9E\u8A72 `_id` \u7684\u539F\u59CB `suggestion` \u4E2D\uFF0C**\u53EA\u63D0\u53D6\u8207\u8A72\u4E3B\u984C\u9AD8\u5EA6\u76F8\u95DC**\u7684\u90A3\u4E00\u6BB5\u6587\u5B57\u4F5C\u70BA `bestSuggestionRawText`\u3002\n     - **\u95DC\u9375\u898F\u5247\uFF1A\u56B4\u7981\u522A\u9664\u539F\u59CB\u6A19\u8A18**\uFF1A\u63D0\u53D6\u6642\uFF0C\u5FC5\u9808**\u5B8C\u6574\u4FDD\u7559**\u8A72\u53E5\u958B\u982D\u7684\u300C\u6642\u9593/\u73ED\u5225/\u5206\u985E\u6A19\u8A18\u300D\uFF08\u4F8B\u5982\uFF1A`0123\u65E9:\u898F\u683C\u5EFA\u8B70_`\uFF09\u3002\n   - **\u591A\u5EFA\u8B70\u6392\u7248\u898F\u5247**\uFF1A\u82E5\u540C\u4E00\u4F4D\u4F7F\u7528\u8005\u91DD\u5C0D\u6B64 Issue \u63D0\u51FA\u4E86\u5169\u9EDE\u6216\u4EE5\u4E0A\u7684\u4E0D\u540C\u5EFA\u8B70\uFF0C\u8ACB\u5728\u4E2D\u9593\u63D2\u5165 **\u5169\u500B\u63DB\u884C\u7B26\u865F (\\n\\n)** \u9032\u884C\u5206\u9694\u3002\n\n## \u8655\u7406\u6D41\u7A0B\n\u5C07\u6240\u6709\u6B78\u7D0D\u597D\u7684\u8CC7\u6599\u8F38\u51FA\u3002\u6CE8\u610F\uFF1A\u78BA\u4FDD `relatedRowIds` \u5B8C\u6574\u5305\u542B\u6240\u6709\u63D0\u53CA\u8A72\u554F\u984C\u7684 `_id`\u3002\n\n## \u8F38\u51FA\u683C\u5F0F (JSON Output Only)\n\u8ACB\u56B4\u683C\u9075\u5B88\u4EE5\u4E0B JSON \u7D50\u69CB\u56DE\u50B3\uFF1A\n\n{\n  \"meta\": {\n    \"title\": \"\u73A9\u5BB6\u9AD4\u9A57\u6E2C\u8A66\u5831\u544A - [\u81EA\u52D5\u5224\u65B7\u5C08\u6848\u540D]\",\n    \"date\": \"[YYYY-MM-DD]\"\n  },\n  \"summary\": {\n    \"content\": \"[40-60\u5B57\u7684\u9AD4\u9A57\u7E3D\u7D50]\",\n    \"impactLevel\": \"High\"\n  },\n  \"criticalIssues\": [\n    {\n      \"issue\": \"[\u6574\u5408\u5F8C\u7684\u73A9\u5BB6\u9AD4\u9A57\u611F\u60F3]\",\n      \"relatedRowIds\": [\"R1\", \"R2\", \"R3\"],\n      \"suggestion\": \"[\u91DD\u5C0D\u6B64\u554F\u984C\u7684\u5177\u9AD4\u512A\u5316\u5EFA\u8B70]\",\n      \"bestSuggestionRawText\": \"[\u7D93\u904E\u7CBE\u6E96\u63D0\u53D6\u8207\u6392\u7248\u5F8C\u7684\u5EFA\u8B70\u6587\u5B57]\",\n      \"bestSuggesterRowId\": \"R1\"\n    }\n  ],\n  \"secondaryIssues\": [ \"\u540C\u6A23\u7D50\u69CB\" ],\n  \"aiAnalysis\": []\n}\n\n## Raw Data Input\n";

window.initialData = {
  meta: {
    title: "\u73A9\u5BB6\u9AD4\u9A57\u6E2C\u8A66\u5831\u544A - \u9810\u8A2D\u5C08\u6848",
    date: new Date().toISOString().split('T')[0],
    testerCount: 0
  },
  summary: {
    content: "\u5C1A\u7121\u8CC7\u6599\uFF0C\u8ACB\u7531\u53F3\u5074\u532F\u5165 Excel \u6E2C\u8A66\u6578\u64DA\uFF0C\u6216\u624B\u52D5\u8F38\u5165\u3002",
    impactLevel: "Medium"
  },
  criticalIssues: [],
  secondaryIssues: [],
  aiAnalysis: []
};