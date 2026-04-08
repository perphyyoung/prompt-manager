import { TagManager, ITagManagerElements } from './TagManager.ts';
import { Constants, ElementId } from '../../constants.ts';

/**
 * 图像标签管理器
 */
export class ImageTagManager extends TagManager {
  constructor(app: any) {
    super('image', app);
  }

  /**
   * 获取图像标签管理器的元素配置
   */
  protected getElementsConfig(): ITagManagerElements {
    return {
      modalId: Constants.Ids.IMAGE_TAG_MANAGER_MODAL,
      closeButtonId: 'closeImageTagManagerModal',
      containerId: 'imageTagGroupCards',
      emptyStateId: 'imageTagManagerEmpty',
      searchInputId: 'imageTagManagerSearchInput',
      clearSearchBtnId: 'clearImageTagManagerSearchBtn',
      sortSelectId: 'imageTagManagerSortSelect',
      orderBtnId: 'imageTagManagerOrderBtn',
      addTagGroupBtnId: 'addImageTagGroupBtn',
      addTagInManagerBtnId: 'addImageTagInManagerBtn',
      batchManageBtnId: 'batchManageImageTagsBtn',
      batchToolbarId: Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR,
      groupEditModalId: 'imageTagGroupEditModal',
      groupEditCloseBtnId: 'closeImageTagGroupEditModal',
      groupEditCancelBtnId: 'cancelImageTagGroupEditBtn',
      groupEditSaveBtnId: 'saveImageTagGroupBtn',
      groupEditTypeInputId: 'imageTagGroupEditType',
      groupEditIdInputId: 'imageTagGroupEditId',
      groupEditNameInputId: 'imageTagGroupEditName',
      groupEditSortOrderInputId: 'imageTagGroupEditSortOrder'
    };
  }

  /**
   * 获取图像面板管理器
   */
  protected getPanelManager(): any {
    return this.app.imagePanelManager;
  }
}

export default ImageTagManager;
