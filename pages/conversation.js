import React from 'react';
import PropTypes from 'prop-types';
import { graphql, withApollo } from 'react-apollo';
import gql from 'graphql-tag';
import { Flex, Box } from '@rebass/grid';
import { get, isEmpty, cloneDeep, update } from 'lodash';

import { MessageSquare } from 'styled-icons/feather/MessageSquare';

import { Router } from '../server/pages';
import { CollectiveType } from '../lib/constants/collectives';
import { ssrNotFoundError } from '../lib/nextjs_utils';
import { withUser } from '../components/UserProvider';
import ErrorPage, { generateError } from '../components/ErrorPage';
import Loading from '../components/Loading';
import CollectiveThemeProvider from '../components/CollectiveThemeProvider';
import Container from '../components/Container';
import CollectiveNavbar from '../components/CollectiveNavbar';
import Page from '../components/Page';
import { FormattedMessage } from 'react-intl';
import { withRouter } from 'next/router';
import Link from '../components/Link';
import StyledLink from '../components/StyledLink';
import MessageBox from '../components/MessageBox';
import StyledButton from '../components/StyledButton';
import { H2, H4 } from '../components/Text';
import StyledTag from '../components/StyledTag';
import Thread from '../components/conversations/Thread';
import CommentForm from '../components/conversations/CommentForm';
import { Sections } from '../components/collective-page/_constants';
import { CommentFieldsFragment } from '../components/conversations/graphql';
import Comment from '../components/conversations/Comment';

const conversationPageQuery = gql`
  query Conversation($collectiveSlug: String!, $id: Int!) {
    Collective(slug: $collectiveSlug, throwIfMissing: false) {
      id
      slug
      path
      name
      type
      canContact
      description
      settings
      imageUrl
      twitterHandle
      isIncognito
    }
    Conversation(id: $id) {
      id
      title
      createdAt
      tags
      body {
        ...CommentFields
      }
      comments {
        nodes {
          ...CommentFields
        }
      }
    }
  }
  ${CommentFieldsFragment}
`;

/**
 * The main page to display collectives. Wrap route parameters and GraphQL query
 * to render `components/collective-page` with everything needed.
 */
class ConversationPage extends React.Component {
  static getInitialProps({ query: { collectiveSlug, id } }) {
    return { collectiveSlug, id: parseInt(id) };
  }

  static propTypes = {
    /** @ignore from getInitialProps */
    collectiveSlug: PropTypes.string.isRequired,
    /** @ignore from getInitialProps */
    id: PropTypes.number.isRequired,
    /** @ignore from withApollo */
    client: PropTypes.object.isRequired,
    /** @ignore from withUser */
    LoggedInUser: PropTypes.object.isRequired,
    /** @ignore from apollo */
    data: PropTypes.shape({
      loading: PropTypes.bool,
      error: PropTypes.any,
      Collective: PropTypes.shape({
        name: PropTypes.string.isRequired,
        description: PropTypes.string,
        type: PropTypes.string.isRequired,
        twitterHandle: PropTypes.string,
        imageUrl: PropTypes.string,
        canContact: PropTypes.bool,
      }),
      Conversation: PropTypes.shape({
        id: PropTypes.number.isRequired,
        title: PropTypes.string.isRequired,
        tags: PropTypes.arrayOf(PropTypes.string),
        body: PropTypes.shape({
          id: PropTypes.number,
        }),
        comments: PropTypes.shape({
          nodes: PropTypes.arrayOf(
            PropTypes.shape({
              id: PropTypes.number,
            }),
          ),
        }),
      }),
    }).isRequired, // from withData
  };

  getPageMetaData(collective) {
    if (collective) {
      return { title: `${collective.name}'s conversations` };
    } else {
      return { title: 'Conversations' };
    }
  }

  clonePageQueryCacheData() {
    const { client, id, collectiveSlug } = this.props;
    const query = conversationPageQuery;
    const variables = { collectiveSlug, id };
    const data = cloneDeep(client.readQuery({ query, variables }));
    return [data, query, variables];
  }

  onCommentAdded = comment => {
    const [data, query, variables] = this.clonePageQueryCacheData();
    update(data, 'Conversation.comments.nodes', comments => [...comments, comment]);
    this.props.client.writeQuery({ query, variables, data });
  };

  onCommentDeleted = comment => {
    const [data, query, variables] = this.clonePageQueryCacheData();
    update(data, 'Conversation.comments.nodes', comments => comments.filter(c => c.id !== comment.id));
    this.props.client.writeQuery({ query, variables, data });
  };

  onConversationDeleted = () => {
    return Router.pushRoute('conversations', { collectiveSlug: this.props.collectiveSlug });
  };

  render() {
    const { collectiveSlug, data, LoggedInUser } = this.props;

    if (!data.loading) {
      if (!data || data.error) {
        return <ErrorPage data={data} />;
      } else if (!data.Collective) {
        ssrNotFoundError(); // Force 404 when rendered server side
        return <ErrorPage error={generateError.notFound(collectiveSlug)} log={false} />;
      } else if (data.Collective.type !== CollectiveType.COLLECTIVE) {
        return <ErrorPage error={generateError.badCollectiveType()} log={false} />;
      }
    }

    const collective = data && data.Collective;
    const conversation = data && data.Conversation;
    const body = conversation && conversation.body;
    const comments = get(conversation, 'comments.nodes', []);
    const canEdit = LoggedInUser && body && LoggedInUser.canEditComment(body);
    return (
      <Page collective={collective} {...this.getPageMetaData(collective)} withoutGlobalStyles>
        {data.loading ? (
          <Container borderTop="1px solid #E8E9EB">
            <Loading />
          </Container>
        ) : (
          <CollectiveThemeProvider collective={data.Collective}>
            <Container borderTop="1px solid #E8E9EB">
              <CollectiveNavbar collective={data.Collective} selected={Sections.CONVERSATIONS} />
              <Box maxWidth={1160} m="0 auto" px={2} py={[4, 5]}>
                <StyledLink as={Link} color="black.600" route="conversations" params={{ collectiveSlug }}>
                  &larr; <FormattedMessage id="Conversations.GoBack" defaultMessage="Back to conversations" />
                </StyledLink>
                <Box mt={4}>
                  {!conversation || !body ? (
                    <MessageBox type="error" withIcon>
                      <FormattedMessage
                        id="conversation.notFound"
                        defaultMessage="This conversation doesn't exist or has been removed."
                      />
                    </MessageBox>
                  ) : (
                    <Flex flexDirection={['column', null, null, 'row']} justifyContent="space-between">
                      <Box flex="1 1 50%" maxWidth={720} mb={5}>
                        <Container borderBottom="1px solid" borderColor="black.300" pb={4}>
                          <H2 fontSize="H4" mb={3}>
                            {conversation.title}
                          </H2>
                          <Comment
                            comment={body}
                            canEdit={canEdit}
                            onDelete={this.onConversationDeleted}
                            deleteModalTitle={
                              <FormattedMessage
                                id="conversation.deleteModalTitle"
                                defaultMessage="Delete this conversation?"
                              />
                            }
                          />
                        </Container>
                        {comments.length > 0 && (
                          <Box mb={3} pt={3}>
                            <Thread items={comments} onCommentDeleted={this.onCommentDeleted} />
                          </Box>
                        )}
                        <Flex mt="40px">
                          <Box display={['none', null, 'block']} flex="0 0" p={3}>
                            <MessageSquare size={24} color="lightgrey" style={{ transform: 'scaleX(-1)' }} />
                          </Box>
                          <Box flex="1 1" maxWidth={[null, null, 'calc(100% - 56px)']}>
                            <CommentForm
                              id="new-comment"
                              ConversationId={conversation.id}
                              onSuccess={this.onCommentAdded}
                            />
                          </Box>
                        </Flex>
                      </Box>
                      <Box display={['none', null, null, 'block']} flex="0 0 360px" ml={[null, null, null, 5]} mb={4}>
                        <Box my={2} mx={2}>
                          <Link route="create-conversation" params={{ collectiveSlug }}>
                            <StyledButton buttonStyle="primary" width="100%" minWidth={170}>
                              <FormattedMessage id="conversations.create" defaultMessage="Create conversation" />
                            </StyledButton>
                          </Link>
                        </Box>

                        <Box mt={4}>
                          <H4 px={2} mb={2} fontWeight="normal">
                            <FormattedMessage id="Conversation.Followers" defaultMessage="Conversation followers" />
                          </H4>
                          <Container background="#f3f3f3" width="100%" height="64px" />
                          <StyledButton mt={2} buttonStyle="secondary" width="100%" minWidth={130} disabled>
                            <FormattedMessage id="actions.follow" defaultMessage="Follow" />
                          </StyledButton>
                        </Box>
                        {!isEmpty(conversation.tags) && (
                          <Box mt={4}>
                            <H4 px={2} mb={2} fontWeight="normal">
                              <FormattedMessage id="Tags" defaultMessage="Tags" />
                            </H4>
                            <Flex flexWrap="wrap">
                              {conversation.tags.map(tag => (
                                <Box key={tag} m={2}>
                                  <StyledTag>{tag}</StyledTag>
                                </Box>
                              ))}
                            </Flex>
                          </Box>
                        )}
                      </Box>
                    </Flex>
                  )}
                </Box>
              </Box>
            </Container>
          </CollectiveThemeProvider>
        )}
      </Page>
    );
  }
}

const getData = graphql(conversationPageQuery, {
  options: {
    pollInterval: 15000, // Will refresh the data every 15s to get new comments
  },
});

export default withUser(getData(withRouter(withApollo(ConversationPage))));
