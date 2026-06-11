/**
 * 全局配置参数
 * 在index.html之前加载
 */
const CONFIG = {
  // 布局参数
  NODE_W: 130,      // 节点默认宽度
  H_GAP: 60,        // 水平间距：父子节点之间
  V_GAP: 16,        // 垂直间距：兄弟节点之间
  EST_H: 58,        // 节点估计高度
  
  // 自动保存间隔（毫秒）
  AUTO_SAVE_INTERVAL: 900000,  // 900秒
  
  // 面板宽度
  PANEL_WIDTH: '40%',
  
  // 工具栏宽度
  TOOLBAR_WIDTH: 36,
  
  // 边距
  LAYOUT_MARGIN: 5   // 对齐布局边距
};

// 冻结配置对象，防止意外修改
Object.freeze(CONFIG);
