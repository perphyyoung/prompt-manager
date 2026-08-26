/**
 * 图像标签管理器
 * 管理图像标签的注册、分组、排序、CRUD 操作
 */
import { TagManager, ITagManagerElements } from './TagManager.ts';
import { Constants } from '../../constants.ts';

export class ImageTagManager extends TagManager {
  constructor(app: any) {
    super('image', app);
  }

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
      groupEditModalId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_MODAL,
      groupEditCloseBtnId: Constants.Ids.CLOSE_IMAGE_TAG_GROUP_EDIT_MODAL,
      groupEditCancelBtnId: Constants.Ids.CANCEL_IMAGE_TAG_GROUP_EDIT_BTN,
      groupEditSaveBtnId: Constants.Ids.SAVE_IMAGE_TAG_GROUP_BTN,
      groupEditTypeInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_TYPE,
      groupEditIdInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_ID,
      groupEditNameInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_NAME,
      groupEditSortOrderInputId: Constants.Ids.IMAGE_TAG_GROUP_EDIT_SORT_ORDER,
    };
  }

  protected getPanelManager(): any {
    return this.app.imagePanelManager;
  }
}
