import * as DOMT from 'DOM_TYPES';
import * as Operations from 'SantiOperations';
import {SantiRuleset} from 'SantiRules';
import {selectNodes} from 'DOM_UTIL';

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
    for (let i = 0, len = ruleset.length; i < len; ++i) {
      const rule = ruleset[i];
      if (Array.isArray(rule)) {
        /* Recursively execute nested rulesets: */
        this.execute(root, rule, currentSelection);
        continue;
      }
      let selectionChanged = false;
      /* If the rule has a select property, overwrite the currentSelection.
       * otherwise, carry forward with the previous selection: */
      let rawSelection;
      if (rule.select) {
        /* Iterate over the raw selection and apply filters: */
        rawSelection = selectNodes(root, rule.select);
      } else if (currentSelection === undefined) {
        /* The defaultSelect property allows rules to state a selector which is
         * only evaluated if there is not already a selection: */
        if (rule.defaultSelect) {
          rawSelection = selectNodes(root, rule.defaultSelect);
        } else {
          throw new Error(
            'Cannot begin Santi ruleset with rule that makes no selection!'
          );
        }
      } else {
        rawSelection = currentSelection;
      }
      /* Filter the selection: */
      const ruleHasFilters = (rule.onlyIf || rule.except);
      if (ruleHasFilters) {
        currentSelection = [];
        selectionChanged = true;
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
        selectionChanged = true;
      }

      const operationName = rule.op;
      if (!operationName) {
        /* Rules without operations are allowed if they alter the selection. */
        if (selectionChanged) {
          continue;
        }
        const errName = (rule.name) ? `with name ${rule.name}} ` : '';
        throw new Error(
          `Rules must alter the selection or perform an operation, but ` +
          `rule ${i} of ${len} ${errName}in the current ruleset the did not.`
        );
      }
      /* Apply the operation to all nodes in the filtered selection: */
      const operation = this.operations[operationName];
      if (!operation) {
        const errName = (rule.name) ? `with name ${rule.name}} ` : '';
        throw new Error(
          `Rule ${i} of ${len} ${errName} had an unrecognized operation name ` +
          `"${operationName}".`
        );
      }
      const configuredOp = operation(rule.arg);
      for (const node of currentSelection) {
        configuredOp(node);
      }
    }
    return root;
  }
}
