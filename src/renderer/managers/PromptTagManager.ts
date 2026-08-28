/**
 * 提示词标签管理器
 * 管理提示词标签的注册、分组、排序、CRUD 操作
 */
import { TagManager, ITagManagerElements } from "./TagManager.ts";
import { Constants } from "../constants.ts";

export class PromptTagManager extends TagManager {
  constructor(app: any) {
    super("prompt", app);
  }

  protected getElementsConfig(): ITagManagerElements {
    return {
      modalId: Constants.Ids.PROMPT_TAG_MANAGER_MODAL,
      closeButtonId: Constants.Ids.CLOSE_PROMPT_TAG_MANAGER_MODAL,
      containerId: Constants.Ids.PROMPT_TAG_GROUP_CARDS,
      emptyStateId: Constants.Ids.PROMPT_TAG_MANAGER_EMPTY,
      searchInputId: Constants.Ids.PROMPT_TAG_MANAGER_SEARCH_INPUT,
      clearSearchBtnId: Constants.Ids.CLEAR_PROMPT_TAG_MANAGER_SEARCH_BTN,
      sortSelectId: Constants.Ids.PROMPT_TAG_MANAGER_SORT_SELECT,
      orderBtnId: Constants.Ids.PROMPT_TAG_MANAGER_ORDER_BTN,
      addTagGroupBtnId: Constants.Ids.ADD_PROMPT_TAG_GROUP_BTN,
      addTagInManagerBtnId: Constants.Ids.ADD_PROMPT_TAG_IN_MANAGER_BTN,
      groupEditModalId: Constants.Ids.PROMPT_TAG_GROUP_EDIT_MODAL,
      groupEditCloseBtnId: Constants.Ids.CLOSE_PROMPT_TAG_GROUP_EDIT_MODAL,
      groupEditCancelBtnId: Constants.Ids.CANCEL_PROMPT_TAG_GROUP_EDIT_BTN,
      groupEditSaveBtnId: Constants.Ids.SAVE_PROMPT_TAG_GROUP_BTN,
      groupEditTypeInputId: Constants.Ids.PROMPT_TAG_GROUP_EDIT_TYPE,
      groupEditIdInputId: Constants.Ids.PROMPT_TAG_GROUP_EDIT_ID,
      groupEditNameInputId: Constants.Ids.PROMPT_TAG_GROUP_EDIT_NAME,
      groupEditSortOrderInputId: Constants.Ids.PROMPT_TAG_GROUP_EDIT_SORT_ORDER,
    };
  }

  protected getPanelManager(): any {
    return this.app.promptPanelManager;
  }
}
