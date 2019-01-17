import * as DOMT from 'DOM_Types';
import {ComplexSelection} from 'DOM_UTIL';
import {semantify} from 'rules/semantify';

/**
 * Indicates a step in the execution of a Santi ruleset. Based on the given
 * selection and filters, the given operation will be performed with the given
 * configuration parameters.
 */
export interface SantiRule {
  select?: string|ComplexSelection;
  defaultSelect?: string|ComplexSelection;
  except?: DOMT.NodeTest;
  onlyIf?: DOMT.NodeTest;
  op?: string;
  arg?: any;

  /* An optional identifier used in error messaged: */
  name?: string;
}
/**
 * A ruleset for Santi must be specified as an array of SantiRules, or an array
 * of other rulesets. In other words, rulesets can nest eachother indefinitely.
 */
export interface SantiRuleset extends Array<SantiRule|SantiRuleset> {
  [index: number]: SantiRule | SantiRuleset;
}
/**
 * A dictionary of standard Santi Rules which can be combined to accomplish
 * most common tasks.
 */
export const STANDARD: {[name: string]: SantiRule|SantiRuleset} = Object.freeze({
  removeVoidWhitespace: {
    select: '#text',
    op: 'remove',
    /* Remove all text nodes that contain non-displayed whitespace: */
    onlyIf(text: Text) {
      if (text.data === '') {
        return true;
      }
      if (!/^\s+$/.test(text.data)) {
        return false;
      }
      const range = document.createRange();
      range.selectNodeContents(text);
      const rect = range.getBoundingClientRect();
      return (rect.width === 0 && rect.height === 0);
    }
  },
  /* Externally defined rules: */
  semantify
});
