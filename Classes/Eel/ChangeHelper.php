<?php

declare(strict_types=1);

namespace Devclaim\NeosModernBackend\Eel;

use Neos\ContentRepository\Core\Projection\ContentGraph\VisibilityConstraints;
use Neos\ContentRepository\Core\SharedModel\Node\NodeAddress;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Eel\ProtectedContextAwareInterface;
use Neos\Flow\Annotations as Flow;

/**
 * For the review of the workspace module ("Devclaim.Change" in Fusion): what kind of element a change is, which the
 * review of Neos does not tell (its label alone, e.g. a headline, says little)
 */
class ChangeHelper implements ProtectedContextAwareInterface
{
    #[Flow\Inject]
    protected ContentRepositoryRegistry $contentRepositoryRegistry;

    /**
     * The label of the node type of a changed node, as configured (a translation id "Vendor:NodeTypes.Name:ui.label"
     * or a text; Fusion translates it with I18n.translate); empty when the node is not found
     */
    public function nodeTypeLabel(string $serializedNodeAddress): string
    {
        try {
            $nodeAddress = NodeAddress::fromJsonString($serializedNodeAddress);
            $contentRepository = $this->contentRepositoryRegistry->get($nodeAddress->contentRepositoryId);
            // a removed node too: the review shows removals
            $node = $contentRepository->getContentGraph($nodeAddress->workspaceName)
                ->getSubgraph($nodeAddress->dimensionSpacePoint, VisibilityConstraints::createEmpty())
                ->findNodeById($nodeAddress->aggregateId);
            if ($node === null) {
                return '';
            }
            return $contentRepository->getNodeTypeManager()->getNodeType($node->nodeTypeName)?->getLabel()
                ?? $node->nodeTypeName->value;
        } catch (\Throwable) {
            return '';
        }
    }

    public function allowsCallOfMethod($methodName): bool
    {
        return true;
    }
}
