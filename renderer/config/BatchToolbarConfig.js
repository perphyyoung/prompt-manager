/**
 * 批量操作工具栏配置
 * 统一定义提示词面板和图像面板的批量操作工具栏配置
 */
export const BatchToolbarConfig = {
  prompt: {
    toolbarId: 'promptBatchToolbar',
    actionsId: 'promptBatchToolbarActions',
    countId: 'promptBatchSelectedCount',
    label: '提示词',
    buttons: [
      { id: 'promptBatchInvertBtn', text: '反选', className: 'btn btn-sm btn-secondary', action: 'Invert' },
      { id: 'promptBatchAddTagBtn', text: '批量添加标签', className: 'btn btn-sm btn-primary', action: 'AddTag' },
      { id: 'promptBatchSetSafeBtn', text: '设为安全', className: 'btn btn-sm btn-primary', action: 'SetSafe' },
      { id: 'promptBatchSetUnsafeBtn', text: '设为不安全', className: 'btn btn-sm btn-warning', action: 'SetUnsafe' },
      { id: 'promptBatchDeleteBtn', text: '批量删除', className: 'btn btn-sm btn-danger', action: 'Delete' },
      { id: 'promptBatchCancelBtn', text: '取消选择', className: 'btn btn-sm btn-secondary', action: 'Cancel' }
    ]
  },

  image: {
    toolbarId: 'imageBatchToolbar',
    actionsId: 'imageBatchToolbarActions',
    countId: 'imageBatchSelectedCount',
    label: '图像',
    buttons: [
      { id: 'imageBatchInvertBtn', text: '反选', className: 'btn btn-sm btn-secondary', action: 'Invert' },
      { id: 'imageBatchAddTagBtn', text: '批量添加标签', className: 'btn btn-sm btn-primary', action: 'AddTag' },
      { id: 'imageBatchSetSafeBtn', text: '设为安全', className: 'btn btn-sm btn-primary', action: 'SetSafe' },
      { id: 'imageBatchSetUnsafeBtn', text: '设为不安全', className: 'btn btn-sm btn-warning', action: 'SetUnsafe' },
      { id: 'imageBatchDeleteBtn', text: '批量删除', className: 'btn btn-sm btn-danger', action: 'Delete' },
      { id: 'imageBatchCancelBtn', text: '取消选择', className: 'btn btn-sm btn-secondary', action: 'Cancel' }
    ]
  }
};