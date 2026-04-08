import { TagManager, ITagManagerElements } from './TagManager.ts';
import { Constants, ElementId } from '../../constants.ts';

/**
 * 提示词标签管理器
 */
export class PromptTagManager extends TagManager {
  constructor(app: any) {
    super('prompt', app);
  }

  /**
   * 获取提示词标签管理器的元素配置
   */
  protected getElementsConfig(): ITagManagerElements {
    return {
      modalId: Constants.Ids.PROMPT_TAG_MANAGER_MODAL,
      closeButtonId: 'closePromptTagManagerModal',
      containerId: 'promptTagGroupCards',
      emptyStateId: 'promptTagManagerEmpty',
      searchInputId: 'promptTagManagerSearchInput',
      clearSearchBtnId: 'clearPromptTagManagerSearchBtn',
      sortSelectId: 'promptTagManagerSortSelect',
      orderBtnId: 'promptTagManagerOrderBtn',
      addTagGroupBtnId: 'addPromptTagGroupBtn',
      addTagInManagerBtnId: 'addPromptTagInManagerBtn',
      batchManageBtnId: 'batchManagePromptTagsBtn',
      batchToolbarId: Constants.Ids.PROMPT_TAG_BATCH_TOOLBAR,
      groupEditModalId: 'promptTagGroupEditModal',
      groupEditCloseBtnId: 'closePromptTagGroupEditModal',
      groupEditCancelBtnId: 'cancelPromptTagGroupEditBtn',
      groupEditSaveBtnId: 'savePromptTagGroupBtn',
      groupEditTypeInputId: 'promptTagGroupEditType',
      groupEditIdInputId: 'promptTagGroupEditId',
      groupEditNameInputId: 'promptTagGroupEditName',
      groupEditSortOrderInputId: 'promptTagGroupEditSortOrder'
    };
  }

  /**
   * 获取提示词面板管理器
   */
  protected getPanelManager(): any {
    return this.app.promptPanelManager;
  }
}

export default PromptTagManager;
