<?php

declare(strict_types=1);

namespace Devclaim\NeosModernBackend\NodeReferences;

use Devclaim\NeosStyleguide\NodeReferences\NodeReferenceResolverInterface;
use Neos\ContentRepository\Core\Projection\ContentGraph\Node;
use Neos\ContentRepository\Core\SharedModel\Node\NodeAddress;
use Neos\ContentRepository\Core\SharedModel\Workspace\WorkspaceName;
use Neos\ContentRepositoryRegistry\ContentRepositoryRegistry;
use Neos\Flow\Annotations as Flow;
use Neos\Neos\Domain\SubtreeTagging\NeosVisibilityConstraints;

/**
 * The node previews of the workspace review (node references of Devclaim.NeosStyleguide, prefix "workspace"):
 * "workspace:after:<node address>" is the node in its workspace, "workspace:before:<node address>" the same node in the
 * base workspace (what publishing would overwrite). Hidden nodes are found too; who may not read a workspace gets
 * nothing (the content repository checks it).
 */
#[Flow\Scope('singleton')]
final class WorkspaceNodeReferenceResolver implements NodeReferenceResolverInterface
{
    public const PREFIX = 'workspace';

    #[Flow\Inject]
    protected ContentRepositoryRegistry $contentRepositoryRegistry;

    public function resolve(string $reference): ?Node
    {
        [$side, $serializedNodeAddress] = explode(':', $reference, 2) + [1 => ''];
        if (!in_array($side, ['before', 'after'], true)) {
            return null;
        }
        try {
            $nodeAddress = NodeAddress::fromJsonString($serializedNodeAddress);
            $contentRepository = $this->contentRepositoryRegistry->get($nodeAddress->contentRepositoryId);
            $workspaceName = $nodeAddress->workspaceName;
            if ($side === 'before') {
                $baseWorkspaceName = $contentRepository->findWorkspaceByName($workspaceName)?->baseWorkspaceName;
                if (!$baseWorkspaceName instanceof WorkspaceName) {
                    return null;
                }
                $workspaceName = $baseWorkspaceName;
            }
            return $contentRepository->getContentGraph($workspaceName)
                ->getSubgraph($nodeAddress->dimensionSpacePoint, NeosVisibilityConstraints::excludeRemoved())
                ->findNodeById($nodeAddress->aggregateId);
        } catch (\Throwable) {
            // not a node address, or no access to the workspace
            return null;
        }
    }
}
