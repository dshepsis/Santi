import * as DOMT from 'DOM_TYPES';
import * as Operations from 'SantiOperations';
import {SantiRuleset} from 'SantiRules';
import {selectNodes} from 'DOM_UTIL';
import {getFirstKey} from 'OTHER_UTIL';

/**
 * Accepts a declarative ruleset used to transform a DOM tree.
 */
export class Santi {
  operations: Operations.OperationLibrary;
  ruleset: SantiRuleset;
  constructor(
    ruleset: SantiRuleset,
    extraOperations: Operations.OperationLibrary = {}
  ) {
    this.ruleset = ruleset;

    /* Copy the standard operation library, which is immutable, to allow for the
     * addition of new operations by external code. */
    this.operations = Object.assign({}, Operations.STANDARD, extraOperations);
  }

  /**
   * Apply the transformations specified by a given ruleset to the given DOM
   * tree or subtree.
   */
  execute(
    root: DOMT.AppendableNode,
    ruleset: SantiRuleset = this.ruleset,
    selection?: Node[]
  ) {
    let currentSelection: Node[]|undefined = selection;
    for (const rule of ruleset) {
      if (Array.isArray(rule)) {
        /* Recursively execute nested rulesets: */
        this.execute(root, rule, currentSelection);
        continue;
      }
      /* If the rule has a select property, overwrite the currentSelection.
       * otherwise, carry forward with the previous selection: */
      let rawSelection;
      if (rule.select) {
        /* Iterate over the raw selection and apply filters: */
        rawSelection = selectNodes(root, rule.select);
      } else if (currentSelection === undefined) {
        throw new Error(
          'Cannot begin Santi ruleset with rule that makes no selection!'
        );
      } else {
        rawSelection = currentSelection;
      }
      /* Filter the selection: */
      const ruleHasFilters = (rule.onlyIf || rule.except);
      if (ruleHasFilters) {
        currentSelection = [];
        for (const node of rawSelection) {
          /* If rule.onlyIf is undefined, then the node is allowed by default: */
          const allowed = (!rule.onlyIf || rule.onlyIf(node));
          const rejected = (!rule.except || rule.except(node));
          if (allowed && !rejected) {
            currentSelection.push(node);
          }
        }
      } else if (rawSelection !== currentSelection) {
        /* If there are no filters in the rule, but the rule made a new
         * selection, copy the raw selection.
         * We must use Array.from because the iterator provided by selectNodes
         * may not be compatible with removing or replacing nodes in-place: */
        currentSelection = Array.from(rawSelection);
      }

      const operationName = getFirstKey(rule, Object.keys(this.operations));
      if (operationName === null) {
        /* If a rule has no operation, move on to the next rule. This may be
         * done to change or filter the selection without applying a
         * transformation. */
        continue;
      }
      /* Apply the operation to all nodes in the filtered selection: */
      const operation = this.operations[operationName](rule[operationName]);
      for (const node of currentSelection) {
        operation(node);
      }
    }
    return root;
  }
}
