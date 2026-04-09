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
      closeButtonId: Constants.Ids.CLOSE_IMAGE_TAG_MANAGER_MODAL,
      containerId: Constants.Ids.IMAGE_TAG_GROUP_CARDS,
      emptyStateId: Constants.Ids.IMAGE_TAG_MANAGER_EMPTY,
      searchInputId: Constants.Ids.IMAGE_TAG_MANAGER_SEARCH_INPUT,
      clearSearchBtnId: Constants.Ids.CLEAR_IMAGE_TAG_MANAGER_SEARCH_BTN,
      sortSelectId: Constants.Ids.IMAGE_TAG_MANAGER_SORT_SELECT,
      orderBtnId: Constants.Ids.IMAGE_TAG_MANAGER_ORDER_BTN,
      addTagGroupBtnId: Constants.Ids.ADD_IMAGE_TAG_GROUP_BTN,
      addTagInManagerBtnId: Constants.Ids.ADD_IMAGE_TAG_IN_MANAGER_BTN,
      batchManageBtnId: Constants.Ids.BATCH_MANAGE_IMAGE_TAGS_BTN,
      batchToolbarId: Constants.Ids.IMAGE_TAG_BATCH_TOOLBAR,
      groupEditModalId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL,
      groupEditCloseBtnId: Constants.Ids.CLOSE_IMAGE_TAG_GROUP_EDIT_MODAL,
      groupEditCancelBtnId: Constants.Ids.CANCEL_IMAGE_TAG_GROUP_EDIT_BTN,
      groupEditSaveBtnId: Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN,
      groupEditTypeInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_TYPE,
      groupEditIdInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_ID,
      groupEditNameInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME,
      groupEditSortOrderInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_SORT_ORDER
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
