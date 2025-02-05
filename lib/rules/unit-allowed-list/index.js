'use strict';

const atRuleParamIndex = require('../../utils/atRuleParamIndex');
const declarationValueIndex = require('../../utils/declarationValueIndex');
const getUnitFromValueNode = require('../../utils/getUnitFromValueNode');
const optionsMatches = require('../../utils/optionsMatches');
const report = require('../../utils/report');
const ruleMessages = require('../../utils/ruleMessages');
const validateObjectWithArrayProps = require('../../utils/validateObjectWithArrayProps');
const validateOptions = require('../../utils/validateOptions');
const valueParser = require('postcss-value-parser');
const { isRegExp, isString } = require('../../utils/validateTypes');

const ruleName = 'unit-allowed-list';

const messages = ruleMessages(ruleName, {
	rejected: (unit) => `Unexpected unit "${unit}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/list/unit-allowed-list',
};

/** @type {import('stylelint').Rule} */
const rule = (primary, secondaryOptions) => {
	const list = [primary].flat();

	return (root, result) => {
		const validOptions = validateOptions(
			result,
			ruleName,
			{
				actual: list,
				possible: [isString],
			},
			{
				optional: true,
				actual: secondaryOptions,
				possible: {
					ignoreFunctions: [isString, isRegExp],
					ignoreProperties: [validateObjectWithArrayProps([isString, isRegExp])],
				},
			},
		);

		if (!validOptions) {
			return;
		}

		/**
		 * @template {import('postcss').AtRule | import('postcss').Declaration} T
		 * @param {T} node
		 * @param {string} value
		 * @param {(node: T) => number} getIndex
		 * @returns {void}
		 */
		function check(node, value, getIndex) {
			// make sure multiplication operations (*) are divided - not handled
			// by postcss-value-parser
			value = value.replace(/\*/g, ',');
			valueParser(value).walk((valueNode) => {
				if (valueNode.type === 'function') {
					const valueLowerCase = valueNode.value.toLowerCase();

					// Ignore wrong units within `url` function
					if (valueLowerCase === 'url') {
						return false;
					}

					if (optionsMatches(secondaryOptions, 'ignoreFunctions', valueLowerCase)) {
						return false;
					}
				}

				const unit = getUnitFromValueNode(valueNode);

				if (!unit || (unit && list.includes(unit.toLowerCase()))) {
					return;
				}

				if (
					'prop' in node &&
					secondaryOptions &&
					optionsMatches(secondaryOptions.ignoreProperties, unit.toLowerCase(), node.prop)
				) {
					return;
				}

				report({
					index: getIndex(node) + valueNode.sourceIndex,
					message: messages.rejected(unit),
					node,
					result,
					ruleName,
				});
			});
		}

		root.walkAtRules(/^media$/i, (atRule) => check(atRule, atRule.params, atRuleParamIndex));
		root.walkDecls((decl) => check(decl, decl.value, declarationValueIndex));
	};
};

rule.primaryOptionArray = true;

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
module.exports = rule;
